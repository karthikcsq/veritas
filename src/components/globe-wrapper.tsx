"use client";

import dynamic from "next/dynamic";

const CSSGlobe = dynamic(() => import("@/components/css-globe"), {
  ssr: false,
});

export function GlobeWrapper() {
  return <CSSGlobe />;
}
