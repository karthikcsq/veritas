"use client";

import { Suspense, useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

// Marble shader material with veining effect
function MarbleGlobe() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color("#e8e0d8") }, // warm white marble
      uColor2: { value: new THREE.Color("#8a8178") }, // warm grey veins
      uColor3: { value: new THREE.Color("#c4b5a5") }, // mid tone
      uAccent: { value: new THREE.Color("#4a6741") }, // subtle green mineral
    }),
    []
  );

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;
    const t = state.clock.elapsedTime;
    materialRef.current.uniforms.uTime.value = t;
    // Slow, elegant rotation
    meshRef.current.rotation.y = t * 0.08;
    meshRef.current.rotation.x = Math.sin(t * 0.05) * 0.1;
  });

  const vertexShader = `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uAccent;

    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    // Simplex-style noise functions for marble veining
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
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    // Fractal brownian motion for layered noise
    float fbm(vec3 p) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      for (int i = 0; i < 6; i++) {
        value += amplitude * snoise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
      }
      return value;
    }

    void main() {
      vec3 pos = vPosition * 2.0;

      // Slowly evolving marble pattern
      float slowTime = uTime * 0.02;

      // Primary veining - turbulent, organic flow
      float vein1 = fbm(pos * 1.5 + vec3(slowTime * 0.5, 0.0, slowTime * 0.3));
      float vein2 = fbm(pos * 3.0 + vec3(0.0, slowTime * 0.4, slowTime * 0.2) + vein1 * 0.5);

      // Sharp vein lines
      float sharpVein = abs(sin(pos.x * 4.0 + vein1 * 6.0 + vein2 * 3.0));
      sharpVein = pow(sharpVein, 3.0);

      // Secondary fine detail veins
      float fineVein = abs(sin(pos.z * 8.0 + pos.y * 5.0 + fbm(pos * 5.0) * 4.0));
      fineVein = pow(fineVein, 5.0);

      // Combine patterns
      vec3 color = uColor1;
      color = mix(color, uColor3, smoothstep(0.2, 0.8, vein1 * 0.5 + 0.5));
      color = mix(color, uColor2, (1.0 - sharpVein) * 0.6);
      color = mix(color, uColor2 * 0.8, (1.0 - fineVein) * 0.25);

      // Subtle green mineral deposits
      float mineral = smoothstep(0.6, 0.8, fbm(pos * 4.0 + vec3(slowTime)));
      color = mix(color, uAccent, mineral * 0.15);

      // Polished marble lighting
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float diff = max(dot(vNormal, lightDir), 0.0);
      float ambient = 0.4;

      // Strong specular for polished look
      vec3 viewDir = normalize(cameraPosition - vPosition);
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(vNormal, halfDir), 0.0), 64.0);

      // Subsurface scattering approximation (marble is slightly translucent)
      float sss = pow(max(dot(-vNormal, lightDir), 0.0), 2.0) * 0.15;

      // Fresnel rim light
      float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);

      vec3 finalColor = color * (ambient + diff * 0.6) + vec3(1.0) * spec * 0.5 + color * sss;
      finalColor += vec3(0.9, 0.88, 0.85) * fresnel * 0.3;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 128, 128]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </mesh>
      {/* Subtle glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.01, 16, 100]} />
        <meshBasicMaterial color="#a09080" transparent opacity={0.3} />
      </mesh>
    </Float>
  );
}

// Orbiting particles to add depth and motion
function Particles({ count = 200 }) {
  const ref = useRef<THREE.Points>(null!);
  const geoRef = useRef<THREE.BufferGeometry>(null!);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3 + Math.random() * 2;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, [count]);

  useEffect(() => {
    if (geoRef.current) {
      geoRef.current.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
    }
  }, [positions]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.03;
    ref.current.rotation.x = t * 0.01;
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geoRef} />
      <pointsMaterial
        size={0.04}
        color="#b0a090"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

export default function MarbleGlobeScene() {
  return (
    <div className="w-full h-[500px] sm:h-[600px] relative">
      {/* Radial gradient backdrop */}
      <div className="absolute inset-0 bg-radial from-stone-200/30 via-transparent to-transparent dark:from-stone-800/20 pointer-events-none" />
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <directionalLight position={[-3, -2, -3]} intensity={0.2} color="#c4b5a5" />
          <MarbleGlobe />
          <Particles />
        </Suspense>
      </Canvas>
    </div>
  );
}
