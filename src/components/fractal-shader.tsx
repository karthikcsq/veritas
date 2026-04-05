"use client";

import { useEffect, useRef } from "react";

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// Created by S. Guillitte 2015 — adapted for WebGL with procedural cubemap

precision highp float;

uniform float iTime;
uniform vec2 iResolution;

float zoom = 1.0;

// hash helpers for procedural noise
float hash(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yxz + 19.19);
  return fract((p.x + p.y) * p.z);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// warm blurry indoor cubemap replacement
vec3 envMap(vec3 rd) {
  // warm base — mid-brightness brown/tan like a room
  vec3 col = mix(vec3(0.3, 0.22, 0.18), vec3(0.5, 0.4, 0.35), 0.5 + 0.5 * rd.y);

  // large soft variation to simulate blurry room features
  float n = fbm(rd * 2.0 + vec3(3.7, 1.2, 5.4));
  col = mix(col, vec3(0.6, 0.5, 0.42), n * 0.6);

  // darker areas (furniture, walls, doorways)
  float dark = fbm(rd * 1.5 + vec3(8.1, 2.3, 0.7));
  col = mix(col, vec3(0.15, 0.1, 0.08), smoothstep(0.35, 0.7, dark) * 0.5);

  // bright warm highlight (window light)
  float bright = fbm(rd * 1.8 + vec3(0.3, 6.1, 2.8));
  col += vec3(0.25, 0.18, 0.12) * smoothstep(0.45, 0.8, bright);

  // secondary cooler highlight for variation
  float bright2 = fbm(rd * 2.5 + vec3(5.2, 0.8, 3.1));
  col += vec3(0.1, 0.12, 0.15) * smoothstep(0.5, 0.85, bright2);

  return col;
}

vec2 csqr(vec2 a) {
  return vec2(a.x*a.x - a.y*a.y, 2.0*a.x*a.y);
}

mat2 rot(float a) {
  return mat2(cos(a), sin(a), -sin(a), cos(a));
}

vec2 iSphere(in vec3 ro, in vec3 rd, in vec4 sph) {
  vec3 oc = ro - sph.xyz;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - sph.w*sph.w;
  float h = b*b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

float map(in vec3 p) {
  float res = 0.0;
  vec3 c = p;
  for (int i = 0; i < 10; ++i) {
    p = 0.7*abs(p + cos(iTime*0.15 + 1.6)*0.15) / dot(p, p) - 0.7 + cos(iTime*0.15)*0.15;
    p.yz = csqr(p.yz);
    p = p.zxy;
    res += exp(-19.0 * abs(dot(p, c)));
  }
  return res / 2.0;
}

vec3 raymarch(in vec3 ro, vec3 rd, vec2 tminmax) {
  float t = tminmax.x;
  float dt = 0.1 - 0.075*cos(iTime*0.025);
  vec3 col = vec3(0.0);
  float c = 0.0;
  for (int i = 0; i < 64; i++) {
    t += dt*exp(-2.0*c);
    if (t > tminmax.y) break;
    c = map(ro + t*rd);
    col = 0.99*col + 0.08*vec3(c*c*c, c*c, c);
  }
  return col;
}

void main() {
  float time = iTime;
  vec2 q = gl_FragCoord.xy / iResolution.xy;
  vec2 p = -1.0 + 2.0 * q;
  p.x *= iResolution.x / iResolution.y;

  // fixed camera — auto-rotate only
  vec2 m = vec2(-0.5);

  vec3 ro = zoom * vec3(4.0);
  ro.yz *= rot(m.y);
  ro.xz *= rot(m.x + 0.25*time);
  vec3 ta = vec3(0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = normalize(cross(uu, ww));
  vec3 rd = normalize(p.x*uu + p.y*vv + 1.2*ww) * 0.975;

  vec2 tmm = iSphere(ro, rd, vec4(0.0, 0.0, 0.0, 2.0));

  vec3 col = raymarch(ro, rd, tmm);

  if (tmm.x < 0.0) {
    // background — environment map
    col = envMap(rd);
  } else {
    // sphere surface — fresnel reflection of environment
    vec3 nor = (ro + tmm.x*rd) / 2.0;
    nor = reflect(rd, nor);
    float fre = pow(0.5 + clamp(dot(nor, rd), 0.0, 1.0), 3.0) * 1.3;
    col += envMap(nor) * fre;
  }

  col = 0.5 * log(1.0 + col);
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function FractalShader({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false });
    if (!gl) return;

    function createShader(
      gl: WebGLRenderingContext,
      type: number,
      source: string
    ) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "iTime");
    const uRes = gl.getUniformLocation(program, "iResolution");

    gl.useProgram(program);

    let animId: number;
    const startTime = performance.now();

    function render() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas!.clientWidth * dpr;
      const h = canvas!.clientHeight * dpr;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
      gl!.viewport(0, 0, w, h);

      const t = (performance.now() - startTime) / 1000;
      gl!.uniform1f(uTime, t);
      gl!.uniform2f(uRes, w, h);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
