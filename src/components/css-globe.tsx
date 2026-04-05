"use client";

import { useEffect, useRef } from "react";
import {
  PerspectiveTransform,
  transformStyleName,
  transformOriginStyleName,
} from "@/lib/perspective-transform";

interface Vertex {
  x: number;
  y: number;
  z: number;
  phi: number;
  theta: number;
  px: number;
  py: number;
  tx: number;
  ty: number;
}

interface GlobeDom extends HTMLDivElement {
  perspectiveTransform: PerspectiveTransform;
  topLeft: Vertex;
  topRight: Vertex;
  bottomLeft: Vertex;
  bottomRight: Vertex;
}

const URLS = {
  diffuse:
    "https://s3-us-west-2.amazonaws.com/s.cdpn.io/6043/css_globe_diffuse.jpg",
  halo: "https://s3-us-west-2.amazonaws.com/s.cdpn.io/6043/css_globe_halo.png",
};

export default function CSSGlobe() {
  const worldRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    const globe = world.querySelector<HTMLDivElement>(".world-globe")!;
    const globeContainer = world.querySelector<HTMLDivElement>(
      ".world-globe-doms-container"
    )!;
    const globePole = world.querySelector<HTMLDivElement>(
      ".world-globe-pole"
    )!;
    const globeHalo = world.querySelector<HTMLDivElement>(
      ".world-globe-halo"
    )!;
    globeHalo.style.backgroundImage = `url(${URLS.halo})`;

    const config = {
      lat: 0,
      lng: 0,
      segX: 14,
      segY: 12,
      isPoleVisible: true,
      autoSpin: true,
      zoom: 0,
    };

    let rX = 0,
      rY = 0,
      rZ = 0;
    let sinRX: number,
      sinRY: number,
      sinRZ: number;
    let cosRX: number,
      cosRY: number,
      cosRZ: number;
    let dragX = 0,
      dragY = 0,
      dragLat = 0,
      dragLng = 0;
    let isMouseDown = false;
    let tick = 1;
    let pixelExpandOffset = 1.5;
    let animId: number;
    let startTime = 0;
    let currentScale = 1;
    let currentTransY = 0;

    // Launch animation state
    const launchDelay = 0.5; // seconds before launch starts (time to render)
    const launchDuration = 2.2; // seconds
    let launchProgress = 0;

    let globeDoms: GlobeDom[] = [];
    let vertices: Vertex[][] = [];

    // Cities as glowing dots
    const GLOBE_RADIUS = 700 / 2;
    const cities = [
      { lat: 40.71, lng: -74.01 },   // New York
      { lat: 51.51, lng: -0.13 },    // London
      { lat: 35.68, lng: 139.69 },   // Tokyo
      { lat: -23.55, lng: -46.63 },  // São Paulo
      { lat: 6.52, lng: 3.38 },      // Lagos
      { lat: 19.08, lng: 72.88 },    // Mumbai
      { lat: -33.87, lng: 151.21 },  // Sydney
      { lat: 52.52, lng: 13.41 },    // Berlin
      { lat: 1.35, lng: 103.82 },    // Singapore
      { lat: -1.29, lng: 36.82 },    // Nairobi
      { lat: 19.43, lng: -99.13 },   // Mexico City
      { lat: 37.57, lng: 126.98 },   // Seoul
      { lat: 30.04, lng: 31.24 },    // Cairo
      { lat: 34.05, lng: -118.24 },  // Los Angeles
      { lat: 48.86, lng: 2.35 },     // Paris
      { lat: -6.21, lng: 106.85 },   // Jakarta
      { lat: -34.60, lng: -58.38 },  // Buenos Aires
      { lat: -33.93, lng: 18.42 },   // Cape Town
      { lat: 31.23, lng: 121.47 },   // Shanghai
      { lat: 55.76, lng: 37.62 },    // Moscow
      { lat: 37.0, lng: -88.5 },     // West Lafayette, IN
    ];

    const cityXYZ = cities.map(({ lat, lng }) => {
      const phi = ((90 - lat) / 180) * Math.PI;
      const theta = ((lng + 180) / 360) * Math.PI * 2;
      return {
        x: -GLOBE_RADIUS * Math.sin(phi) * Math.cos(theta),
        y: -GLOBE_RADIUS * Math.cos(phi),
        z: GLOBE_RADIUS * Math.sin(phi) * Math.sin(theta),
      };
    });

    const dotsContainer = world.querySelector<HTMLDivElement>(".world-globe-dots")!;
    // Clear any existing dots (React strict mode double-mount)
    while (dotsContainer.firstChild) dotsContainer.removeChild(dotsContainer.firstChild);
    const dotEls: HTMLDivElement[] = [];

    for (let i = 0; i < cities.length; i++) {
      const dot = document.createElement("div");
      const s = dot.style;
      s.position = "absolute";
      s.width = "6px";
      s.height = "6px";
      s.borderRadius = "50%";
      s.background = "rgba(255, 230, 130, 0.95)";
      s.boxShadow = "0 0 5px 2px rgba(255, 230, 130, 0.7), 0 0 14px 4px rgba(255, 230, 130, 0.35)";
      s.pointerEvents = "none";
      s.opacity = "0";
      s.transform = "translate(-50%, -50%)";
      dotsContainer.appendChild(dot);
      dotEls.push(dot);
    }

    let dotsFadeStart = 0;
    const dotsFadeStagger = 0.08;

    // Glass panels — 5 cities with large offsets to float above the globe
    // idx maps to cities array: 0=NYC, 1=London, 2=Tokyo, 13=LA, 20=West Lafayette
    const panelCities = [
      { idx: 0,  offsetX: 400,  offsetY: -80,  label: "New York",       dataId: "panel-nyc" },
      { idx: 1,  offsetX: -420, offsetY: -60,  label: "London",         dataId: "panel-london" },
      { idx: 2,  offsetX: -400, offsetY: 100,  label: "Tokyo",          dataId: "panel-tokyo" },
      { idx: 13, offsetX: 420,  offsetY: 80,   label: "Los Angeles",    dataId: "panel-la" },
      { idx: 20, offsetX: -410, offsetY: -180, label: "West Lafayette", dataId: "panel-wlaf" },
    ];

    // Panels container must be a direct child of <main> (the nearest positioned ancestor
    // that also parents the text overlays) so panels z-index (35) sits between
    // the description text (z-25) and the top heading (z-40).
    const mainEl = world.closest("main")!;
    let panelsContainer = mainEl.querySelector<HTMLDivElement>(".world-globe-panels");
    if (!panelsContainer) {
      panelsContainer = document.createElement("div");
      panelsContainer.className = "world-globe-panels";
      panelsContainer.style.position = "absolute";
      panelsContainer.style.left = "0";
      panelsContainer.style.right = "0";
      panelsContainer.style.top = "0";
      panelsContainer.style.bottom = "0";
      panelsContainer.style.zIndex = "35";
      panelsContainer.style.pointerEvents = "none";
      panelsContainer.style.overflow = "hidden";
      mainEl.appendChild(panelsContainer);
    }
    while (panelsContainer.firstChild) panelsContainer.removeChild(panelsContainer.firstChild);

    // Inject SVG distortion filter once
    if (!document.getElementById("glass-distortion-svg")) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "glass-distortion-svg";
      svg.style.display = "none";
      svg.innerHTML = `<filter id="glass-distortion">
        <feTurbulence type="turbulence" baseFrequency="0.008" numOctaves="2" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="77"/>
      </filter>`;
      document.body.appendChild(svg);
    }

    // Inject liquid glass keyframes once
    if (!document.getElementById("glass-float-style")) {
      const styleEl = document.createElement("style");
      styleEl.id = "glass-float-style";
      styleEl.textContent = `
        @keyframes floatDistort {
          0% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
          100% { background-position: 0% 0%; }
        }
      `;
      document.head.appendChild(styleEl);
    }

    const panelEls: { panel: HTMLDivElement; line: HTMLDivElement }[] = [];
    let panelsFadeStart = 0;
    const panelDelay = 1.2;
    const panelStagger = 0.3;

    for (let p = 0; p < panelCities.length; p++) {
      // Connector line
      const line = document.createElement("div");
      const ls = line.style;
      ls.position = "absolute";
      ls.width = "1px";
      ls.background = "rgba(255, 230, 130, 0.4)";
      ls.pointerEvents = "none";
      ls.opacity = "0";
      ls.transformOrigin = "0 0";
      panelsContainer.appendChild(line);

      // Liquid glass panel
      const panel = document.createElement("div");
      const ps = panel.style;
      ps.position = "absolute";
      ps.width = "280px";
      ps.height = "175px";
      ps.borderRadius = "20px";
      ps.overflow = "hidden";
      ps.boxShadow = "0 6px 24px rgba(0, 0, 0, 0.3)";
      ps.pointerEvents = "none";
      ps.opacity = "0";
      ps.transform = "translate(-50%, -50%) scale(0.85)";
      panel.setAttribute("data-panel", panelCities[p].dataId);

      // Layer 1: glass-filter (backdrop blur + SVG distortion)
      const glassFilter = document.createElement("div");
      glassFilter.style.cssText = `
        position: absolute; inset: 0; border-radius: inherit; z-index: 1;
        backdrop-filter: blur(4px);
        filter: url(#glass-distortion) saturate(120%) brightness(1.15);
      `;
      panel.appendChild(glassFilter);

      // Layer 2: distortion overlay (animated radial gradients)
      const distortOverlay = document.createElement("div");
      distortOverlay.style.cssText = `
        position: absolute; inset: 0; border-radius: inherit; z-index: 2;
        background: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.05) 0%, transparent 80%),
                    radial-gradient(circle at 80% 70%, rgba(255,255,255,0.05) 0%, transparent 80%);
        background-size: 300% 300%;
        animation: floatDistort 10s infinite ease-in-out;
        mix-blend-mode: overlay;
        pointer-events: none;
      `;
      panel.appendChild(distortOverlay);

      // Layer 3: glass overlay (tinted bg)
      const glassOverlay = document.createElement("div");
      glassOverlay.style.cssText = `
        position: absolute; inset: 0; border-radius: inherit; z-index: 2;
        background: rgba(0, 0, 0, 0.25);
      `;
      panel.appendChild(glassOverlay);

      // Layer 4: specular highlight
      const glassSpecular = document.createElement("div");
      glassSpecular.style.cssText = `
        position: absolute; inset: 0; border-radius: inherit; z-index: 3;
        box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.15);
      `;
      panel.appendChild(glassSpecular);

      // Layer 5: content area (media slot + label)
      const content = document.createElement("div");
      content.style.cssText = `
        position: relative; z-index: 4; width: 100%; height: 100%;
        border-radius: inherit; overflow: hidden;
      `;

      // Media slot — img element ready for gif src
      const media = document.createElement("img");
      media.style.cssText = `
        width: 100%; height: 100%; object-fit: cover;
        border-radius: 20px; display: none;
      `;
      media.setAttribute("data-slot", "media");
      content.appendChild(media);

      // Label overlay at bottom
      const lbl = document.createElement("div");
      lbl.style.cssText = `
        position: absolute; bottom: 0; left: 0; right: 0;
        padding: 6px 10px; font-size: 10px; color: rgba(255,255,255,0.5);
        font-family: system-ui, sans-serif; letter-spacing: 0.06em;
        background: linear-gradient(transparent, rgba(0,0,0,0.5));
        border-radius: 0 0 20px 20px;
      `;
      lbl.textContent = panelCities[p].label.toUpperCase();
      content.appendChild(lbl);

      panel.appendChild(content);
      panelsContainer.appendChild(panel);
      panelEls.push({ panel, line });
    }

    function updatePanels(elapsed: number, globeScale: number, globeTransY: number) {
      if (dotsFadeStart === 0) return;
      if (panelsFadeStart === 0 && (elapsed - dotsFadeStart) > panelDelay) {
        panelsFadeStart = elapsed;
      }
      if (panelsFadeStart === 0) return;

      const panelElapsed = elapsed - panelsFadeStart;
      // Globe center in main-relative coords
      const mainRect = mainEl.getBoundingClientRect();
      const globeRect = globe.getBoundingClientRect();
      const globeCenterX = globeRect.left + globeRect.width / 2 - mainRect.left;
      const globeCenterY = globeRect.top + globeRect.height / 2 - mainRect.top;

      for (let p = 0; p < panelCities.length; p++) {
        const { idx, offsetX, offsetY } = panelCities[p];
        const { x, y, z } = cityXYZ[idx];

        // Rotate — same math as globe
        let x0 = x * cosRY - z * sinRY;
        let z0 = z * cosRY + x * sinRY;
        const y0 = y * cosRX - z0 * sinRX;
        z0 = z0 * cosRX + y * sinRX;
        const x1 = x0 * cosRZ - y0 * sinRZ;
        const y1 = y0 * cosRZ + x0 * sinRZ;

        const { panel, line } = panelEls[p];

        // Staggered fade
        const fade = Math.min(Math.max((panelElapsed - p * panelStagger) / 0.8, 0), 1);

        if (z0 > 0 && fade > 0) {
          const perspOffset = 1 + z0 / 4000;
          // Dot position in globe-local coords, scaled by globe transform
          const rawDotX = x1 * perspOffset * globeScale;
          const rawDotY = y1 * perspOffset * globeScale + globeTransY;
          // Convert to main-relative coords
          const dotX = globeCenterX + rawDotX;
          const dotY = globeCenterY + rawDotY;
          const panelX = dotX + offsetX;
          const panelY = dotY + offsetY;

          // Edge fade — fade out near top/bottom of viewport
          const edgeFadeTop = Math.min(Math.max(panelY / 100, 0), 1);
          const edgeFadeBot = Math.min(Math.max((mainRect.height - panelY) / 80, 0), 1);
          const edgeFade = Math.min(edgeFadeTop, edgeFadeBot);

          const depthFade = 0.4 + 0.6 * (z0 / GLOBE_RADIUS);
          const totalOpacity = fade * depthFade * edgeFade;

          panel.style.left = panelX + "px";
          panel.style.top = panelY + "px";
          panel.style.opacity = `${totalOpacity}`;
          panel.style.transform = `translate(-50%, -50%) scale(${0.85 + 0.15 * fade})`;

          // Connector line
          const dx = panelX - dotX;
          const dy = panelY - dotY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          line.style.left = dotX + "px";
          line.style.top = dotY + "px";
          line.style.width = dist + "px";
          line.style.height = "1px";
          line.style.transform = `rotate(${angle}deg)`;
          line.style.background = `rgba(255, 230, 130, ${0.35 * totalOpacity})`;
          line.style.opacity = "1";
        } else {
          panel.style.opacity = "0";
          line.style.opacity = "0";
        }
      }
    }

    function updateDots(elapsed: number) {
      // Only start after launch completes
      if (launchProgress < 1) return;
      if (dotsFadeStart === 0) dotsFadeStart = elapsed;

      const fadeElapsed = elapsed - dotsFadeStart;

      for (let i = 0; i < cityXYZ.length; i++) {
        const { x, y, z } = cityXYZ[i];

        // Same rotation as globe
        let x0 = x * cosRY - z * sinRY;
        let z0 = z * cosRY + x * sinRY;
        const y0 = y * cosRX - z0 * sinRX;
        z0 = z0 * cosRX + y * sinRX;
        const x1 = x0 * cosRZ - y0 * sinRZ;
        const y1 = y0 * cosRZ + x0 * sinRZ;

        // Staggered smooth fade-in
        const dotFade = Math.min(Math.max((fadeElapsed - i * dotsFadeStagger) / 1.0, 0), 1);

        const el = dotEls[i];
        if (z0 > 0) {
          const perspOffset = 1 + z0 / 4000;
          el.style.left = (x1 * perspOffset) + "px";
          el.style.top = (y1 * perspOffset) + "px";
          const depthOpacity = 0.4 + 0.6 * (z0 / GLOBE_RADIUS);
          el.style.opacity = `${depthOpacity * dotFade}`;
          el.style.display = "block";
        } else {
          el.style.display = "none";
        }
      }

      updatePanels(elapsed, currentScale, currentTransY);
    }

    function clamp(x: number, min: number, max: number) {
      return x < min ? min : x > max ? max : x;
    }

    function clampLng(lng: number) {
      return ((lng + 180) % 360) - 180;
    }

    function regenerateGlobe() {
      globeDoms = [];
      while (globeContainer.firstChild) {
        globeContainer.removeChild(globeContainer.firstChild);
      }

      const { segX, segY } = config;
      const diffuseStyle = `url(${URLS.diffuse})`;
      const segWidth = (1600 / segX) | 0;
      const segHeight = (800 / segY) | 0;
      vertices = [];

      const radius = 700 / 2;
      const phiStart = 0;
      const phiLength = Math.PI * 2;
      const thetaStart = 0;
      const thetaLength = Math.PI;

      for (let y = 0; y <= segY; y++) {
        const row: Vertex[] = [];
        for (let x = 0; x <= segX; x++) {
          const u = x / segX;
          const v = 0.05 + (y / segY) * (1 - 0.1);
          row.push({
            x:
              -radius *
              Math.cos(phiStart + u * phiLength) *
              Math.sin(thetaStart + v * thetaLength),
            y: -radius * Math.cos(thetaStart + v * thetaLength),
            z:
              radius *
              Math.sin(phiStart + u * phiLength) *
              Math.sin(thetaStart + v * thetaLength),
            phi: phiStart + u * phiLength,
            theta: thetaStart + v * thetaLength,
            px: 0,
            py: 0,
            tx: 0,
            ty: 0,
          });
        }
        vertices.push(row);
      }

      for (let y = 0; y < segY; y++) {
        for (let x = 0; x < segX; x++) {
          const dom = document.createElement("div") as GlobeDom;
          const s = dom.style;
          s.position = "absolute";
          s.width = segWidth + "px";
          s.height = segHeight + "px";
          s.overflow = "hidden";
          (s as unknown as Record<string, unknown>)[transformOriginStyleName] = "0 0";
          s.backgroundImage = diffuseStyle;
          s.backgroundPosition = -segWidth * x + "px " + -segHeight * y + "px";
          dom.perspectiveTransform = new PerspectiveTransform(
            dom,
            segWidth,
            segHeight
          );
          dom.topLeft = vertices[y][x];
          dom.topRight = vertices[y][x + 1];
          dom.bottomLeft = vertices[y + 1][x];
          dom.bottomRight = vertices[y + 1][x + 1];
          globeContainer.appendChild(dom);
          globeDoms.push(dom);
        }
      }
    }

    function rotate(vertex: Vertex, x: number, y: number, z: number) {
      let x0 = x * cosRY - z * sinRY;
      let z0 = z * cosRY + x * sinRY;
      const y0temp = y * cosRX - z0 * sinRX;
      z0 = z0 * cosRX + y * sinRX;
      const x1 = x0 * cosRZ - y0temp * sinRZ;
      const y0final = y0temp * cosRZ + x0 * sinRZ;
      const offset = 1 + z0 / 4000;
      vertex.px = x1 * offset;
      vertex.py = y0final * offset;
    }

    function expand(v1: Vertex, v2: Vertex) {
      const x = v2.px - v1.px;
      const y = v2.py - v1.py;
      const det = x * x + y * y;
      if (det === 0) {
        v1.tx = v1.px;
        v1.ty = v1.py;
        v2.tx = v2.px;
        v2.ty = v2.py;
        return;
      }
      const idet = pixelExpandOffset / Math.sqrt(det);
      const ex = x * idet;
      const ey = y * idet;
      v2.tx = v2.px + ex;
      v2.ty = v2.py + ey;
      v1.tx = v1.px - ex;
      v1.ty = v1.py - ey;
    }

    function transformGlobe() {
      const { segX, segY } = config;

      if ((tick ^= 1)) {
        sinRY = Math.sin(rY);
        sinRX = Math.sin(-rX);
        sinRZ = Math.sin(rZ);
        cosRY = Math.cos(rY);
        cosRX = Math.cos(-rX);
        cosRZ = Math.cos(rZ);

        for (let y = 0; y <= segY; y++) {
          const row = vertices[y];
          for (let x = 0; x <= segX; x++) {
            const v = row[x];
            rotate(v, v.x, v.y, v.z);
          }
        }

        for (let y = 0; y < segY; y++) {
          for (let x = 0; x < segX; x++) {
            const dom = globeDoms[x + segX * y];
            const v1 = dom.topLeft;
            const v2 = dom.topRight;
            const v3 = dom.bottomLeft;
            const v4 = dom.bottomRight;

            expand(v1, v2);
            expand(v2, v3);
            expand(v3, v4);
            expand(v4, v1);

            const pt = dom.perspectiveTransform;
            pt.topLeft.x = v1.tx;
            pt.topLeft.y = v1.ty;
            pt.topRight.x = v2.tx;
            pt.topRight.y = v2.ty;
            pt.bottomLeft.x = v3.tx;
            pt.bottomLeft.y = v3.ty;
            pt.bottomRight.x = v4.tx;
            pt.bottomRight.y = v4.ty;

            if (!(pt.hasError = pt.checkError())) {
              pt.calc();
            }
          }
        }
      } else {
        for (let i = 0, len = globeDoms.length; i < len; i++) {
          const pt = globeDoms[i].perspectiveTransform;
          if (!pt.hasError) {
            pt.update();
          } else {
            (pt.style as unknown as Record<string, unknown>)[transformStyleName] =
              "translate3d(-8192px, 0, 0)";
          }
        }
      }
    }

    // Ease-out back (slight overshoot for a "pop" feel)
    function easeOutBack(t: number): number {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    function render(time: number) {
      if (startTime === 0) startTime = time;
      const elapsed = (time - startTime) / 1000;

      // Launch animation with initial delay
      const launchElapsed = Math.max(0, elapsed - launchDelay);
      launchProgress = Math.min(launchElapsed / launchDuration, 1);
      const eased = easeOutBack(launchProgress);

      if (config.autoSpin && !isMouseDown) {
        config.lng = clampLng(config.lng - 0.2);
      }

      rX = (config.lat / 180) * Math.PI;
      rY = ((clampLng(config.lng) - 270) / 180) * Math.PI;

      globePole.style.display = config.isPoleVisible ? "block" : "none";

      // Compute trig every frame for dots (transformGlobe only does it on alternating ticks)
      sinRY = Math.sin(rY);
      sinRX = Math.sin(-rX);
      sinRZ = Math.sin(rZ);
      cosRY = Math.cos(rY);
      cosRX = Math.cos(-rX);
      cosRZ = Math.cos(rZ);

      const ratio = Math.pow(config.zoom, 1.5);
      pixelExpandOffset = 1.5 + ratio * -1.25;
      const scaleRatio = 1 + ratio * 3;

      // Apply launch: scale from 0 → 1, translate from below → 0
      const launchScale = eased * scaleRatio;
      const launchY = (1 - eased) * 400;
      currentScale = launchScale;
      currentTransY = launchY;
      (globe.style as unknown as Record<string, unknown>)[transformStyleName] =
        `translate3d(0, ${launchY}px, 0) scale3d(${launchScale},${launchScale},1)`;

      // Fade in halo with the launch
      globeHalo.style.opacity = `${Math.min(launchProgress * 1.5, 1)}`;

      transformGlobe();
      updateDots(elapsed);
    }

    function loop(time: number) {
      render(time);
      animId = requestAnimationFrame(loop);
    }

    // Mouse/touch handlers
    function onMouseDown(evt: MouseEvent | { pageX: number; pageY: number }) {
      isMouseDown = true;
      dragX = evt.pageX;
      dragY = evt.pageY;
      dragLat = config.lat;
      dragLng = config.lng;
    }

    function onMouseMove(evt: MouseEvent | { pageX: number; pageY: number }) {
      if (isMouseDown) {
        config.lat = clamp(dragLat + (evt.pageY - dragY) * 0.5, -90, 90);
        config.lng = clampLng(dragLng - (evt.pageX - dragX) * 0.5);
      }
    }

    function onMouseUp() {
      isMouseDown = false;
    }

    function onTouchStart(evt: TouchEvent) {
      evt.preventDefault();
      onMouseDown({
        pageX: evt.changedTouches[0].pageX,
        pageY: evt.changedTouches[0].pageY,
      });
    }

    function onTouchMove(evt: TouchEvent) {
      evt.preventDefault();
      onMouseMove({
        pageX: evt.changedTouches[0].pageX,
        pageY: evt.changedTouches[0].pageY,
      });
    }

    function onTouchEnd(evt: TouchEvent) {
      evt.preventDefault();
      onMouseUp();
    }

    // Init
    regenerateGlobe();

    world.ondragstart = () => false;
    world.addEventListener("mousedown", onMouseDown as EventListener);
    world.addEventListener("mousemove", onMouseMove as EventListener);
    world.addEventListener("mouseup", onMouseUp);
    world.addEventListener("touchstart", onTouchStart, { passive: false });
    world.addEventListener("touchmove", onTouchMove, { passive: false });
    world.addEventListener("touchend", onTouchEnd, { passive: false });

    // Start globe hidden, let the launch animation reveal it
    globe.style.opacity = "0";
    requestAnimationFrame(() => {
      globe.style.opacity = "1";
      animId = requestAnimationFrame(loop);
    });

    cleanupRef.current = () => {
      cancelAnimationFrame(animId);
      world.removeEventListener("mousedown", onMouseDown as EventListener);
      world.removeEventListener("mousemove", onMouseMove as EventListener);
      world.removeEventListener("mouseup", onMouseUp);
      world.removeEventListener("touchstart", onTouchStart);
      world.removeEventListener("touchmove", onTouchMove);
      world.removeEventListener("touchend", onTouchEnd);
      panelsContainer?.remove();
    };

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <div
      ref={worldRef}
      className="world"
      style={{
        position: "relative",
        width: "100%",
        height: "750px",
        cursor: "grab",
      }}
    >
      <div
        className="world-globe"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
        }}
      >
        <div
          className="world-globe-pole"
          style={{
            position: "absolute",
            width: 700,
            height: 700,
            left: -350,
            top: -350,
            borderRadius: "50%",
            backgroundColor: "#0a1628",
          }}
        />
        <div
          className="world-globe-doms-container"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
          }}
        />
        <div
          className="world-globe-dots"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
            zIndex: 10,
          }}
        />
        <div
          className="world-globe-halo"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 952,
            height: 934,
            marginLeft: -480,
            marginTop: -457,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>
    </div>
  );
}
