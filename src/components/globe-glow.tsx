/* eslint-disable react/no-unknown-property */
"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

const smokeVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const smokeFragmentShader = `
precision highp float;
uniform float uTime;
varying vec2 vUv;
varying vec3 vPosition;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amp * snoise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return value;
}

void main() {
  vec2 center = vUv - 0.5;
  float dist = length(center);

  // Ring shape — smoke concentrated in a ring around the globe
  float ring = smoothstep(0.15, 0.25, dist) * smoothstep(0.5, 0.35, dist);

  // Flowing noise for smoke wisps
  float t = uTime * 0.15;
  vec3 noiseCoord = vec3(center * 3.0, t);
  float smoke1 = fbm(noiseCoord);
  float smoke2 = fbm(noiseCoord + vec3(5.2, 1.3, t * 0.5));
  float smoke3 = fbm(noiseCoord * 1.5 + vec3(smoke1 * 0.5, smoke2 * 0.5, t * 0.3));

  float smokePattern = smoke1 * 0.4 + smoke2 * 0.3 + smoke3 * 0.3;
  smokePattern = smokePattern * 0.5 + 0.5; // remap to 0-1

  // Wispy tendrils extending outward
  float angle = atan(center.y, center.x);
  float tendril = snoise(vec3(angle * 2.0, dist * 4.0, t * 0.5));
  tendril = smoothstep(0.0, 0.6, tendril);

  float alpha = ring * smokePattern * 0.8;
  alpha += tendril * smoothstep(0.5, 0.3, dist) * 0.3;
  alpha = clamp(alpha, 0.0, 1.0);

  // Green color with variation
  vec3 col1 = vec3(0.494, 0.792, 0.612); // #7ECA9C
  vec3 col2 = vec3(0.8, 1.0, 0.741);     // #CCFFBD
  vec3 col3 = vec3(0.667, 0.941, 0.82);  // #AAF0D1
  vec3 color = mix(col1, col2, smokePattern);
  color = mix(color, col3, tendril * 0.5);

  // Emissive — let Bloom do the heavy lifting
  color *= 1.5;

  gl_FragColor = vec4(color * alpha, alpha);
}
`;

function SmokePlane() {
  const ref = useRef<THREE.ShaderMaterial>(null!);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    []
  );

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh>
      <planeGeometry args={[8, 8, 1, 1]} />
      <shaderMaterial
        ref={ref}
        vertexShader={smokeVertexShader}
        fragmentShader={smokeFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function GlobeGlow({ opacity = 1 }: { opacity?: number }) {
  return (
    <div style={{ width: "100%", height: "100%", opacity, transition: "opacity 0.3s" }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 2]}
      >
        <SmokePlane />
        <EffectComposer>
          <Bloom
            intensity={3.0}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
