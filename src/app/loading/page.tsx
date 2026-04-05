"use client";

import { FractalShader } from "@/components/fractal-shader";

export default function LoadingPage() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <FractalShader />
    </div>
  );
}
