"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlobeWrapper } from "@/components/globe-wrapper";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { LogoLoop } from "@/components/logo-loop";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { getSession, signIn } from "next-auth/react";

const Dither = dynamic(() => import("@/components/dither"), { ssr: false });
const Balatro = dynamic(() => import("@/components/balatro"), { ssr: false });

const DEFAULT_ACTION = "verify-account";

async function getRpContext(action: string): Promise<RpContext> {
  const res = await fetch("/api/world-id/rp-signature", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err === "object" && err && "error" in err
        ? String((err as { error: string }).error)
        : "Failed to get RP signature",
    );
  }
  const rpSig = await res.json();
  return {
    rp_id: rpSig.rp_id,
    nonce: rpSig.nonce,
    created_at: rpSig.created_at,
    expires_at: rpSig.expires_at,
    signature: rpSig.sig,
  };
}

async function routeAfterLogin() {
  const session = await getSession();
  const requiresOnboarding = Boolean(
    (session?.user as { requiresOnboarding?: boolean } | undefined)
      ?.requiresOnboarding,
  );
  window.location.assign(
    requiresOnboarding ? "/auth/onboarding" : "/dashboard",
  );
}

function GlassOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-lg" />
      {/* Glass card */}
      <div
        className="relative w-full max-w-md mx-4 rounded-[26px] border border-white/20 bg-black/40 backdrop-blur-3xl shadow-2xl shadow-black/20 p-8"
        style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1), 0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors text-xl leading-none"
        >
          &times;
        </button>
        {children}
      </div>
    </div>
  );
}

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [redirecting, setRedirecting] = useState(false);

  // World ID state
  const [worldIdOpen, setWorldIdOpen] = useState(false);
  const [worldIdStarting, setWorldIdStarting] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const rpContextRef = useRef<RpContext | null>(null);
  const verifyingRef = useRef(false);
  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}` | undefined;
  const preset = orbLegacy();

  async function handleSignIn(emailVal: string, passwordVal: string, callbackUrl: string) {
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email: emailVal,
      password: passwordVal,
      redirect: false,
    });
    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      window.location.href = callbackUrl;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleSignIn(email, password, "/dashboard");
  }

  const verifyOnBackend = useCallback(async (result: IDKitResult) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    const ctx = rpContextRef.current;
    if (!ctx) { verifyingRef.current = false; throw new Error("Missing RP context"); }

    const response = await fetch("/api/verify-proof", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rp_id: ctx.rp_id, idkitResponse: result }),
    });
    if (!response.ok) throw new Error("Backend verification failed");

    const authResult = await signIn("world-id", {
      idkitResponse: JSON.stringify(result),
      redirect: false,
      callbackUrl: "/dashboard",
    });
    if (authResult?.error) throw new Error("World ID sign-in failed");
  }, []);

  const startWorldIdLogin = async () => {
    if (!appId) { setError("World ID app not configured"); return; }
    setWorldIdStarting(true);
    setError("");
    try {
      const ctx = await getRpContext(DEFAULT_ACTION);
      rpContextRef.current = ctx;
      setRpContext(ctx);
      setWorldIdOpen(true);
    } catch {
      rpContextRef.current = null;
      setRpContext(null);
      setError("Failed to start World ID login");
    } finally {
      setWorldIdStarting(false);
    }
  };

  const onWorldIdOpenChange = (next: boolean) => {
    setWorldIdOpen(next);
    if (!next) { rpContextRef.current = null; verifyingRef.current = false; setRpContext(null); }
  };

  if (redirecting) {
    return (
      <div className="space-y-5 text-center py-12">
        <Image src="/logo.png" alt="Veritas" width={44} height={44} className="mx-auto mb-3" style={{ filter: "brightness(1.4)" }} />
        <h2 className="text-2xl font-bold text-white">Taking you to your dashboard...</h2>
        <p className="text-sm text-white/60">Verification complete. Redirecting now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <Image src="/logo.png" alt="Veritas" width={44} height={44} className="mx-auto rounded-full mb-3" style={{ filter: "brightness(1.4)" }} />
        <h2 className="text-2xl font-bold text-white">Welcome back</h2>
        <p className="text-sm text-white/60">Sign in to your account</p>
      </div>

      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}

      {/* World ID button */}
      <button
        type="button"
        onClick={startWorldIdLogin}
        disabled={worldIdStarting || loading}
        className="w-full h-11 rounded-lg bg-white/90 hover:bg-white text-black font-semibold transition-all border border-white/20 shadow-lg shadow-white/5 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>
        {worldIdStarting ? "Preparing..." : "Sign in with World ID"}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-white/30">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Email/password form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email" className="text-white/80">Email</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="researcher@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-white/40 focus-visible:ring-white/20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password" className="text-white/80">Password</Label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-white/40 focus-visible:ring-white/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-9 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur text-white font-medium transition-all border border-white/20 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-white/50">
        Don&apos;t have an account?{" "}
        <button type="button" onClick={onSwitch} className="text-white/80 underline hover:text-white">
          Register
        </button>
      </p>

      {/* Demo accounts */}
      <div className="border-t border-white/10 pt-4 space-y-2">
        <p className="text-center text-xs text-white/40">Demo Accounts</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSignIn("researcher@demo.veritas", "demo123", "/dashboard")}
            className="flex-1 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm font-medium transition-all border border-white/10 disabled:opacity-50"
          >
            Researcher
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSignIn("participant@demo.veritas", "demo123", "/study/demo-study/survey")}
            className="flex-1 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm font-medium transition-all border border-white/10 disabled:opacity-50"
          >
            Participant
          </button>
        </div>
      </div>

      {/* World ID widget (rendered outside modal visually but controlled by state) */}
      {rpContext && (
        <IDKitRequestWidget
          open={worldIdOpen}
          onOpenChange={onWorldIdOpenChange}
          app_id={appId!}
          action={DEFAULT_ACTION}
          rp_context={rpContext}
          allow_legacy_proofs
          preset={preset}
          handleVerify={verifyOnBackend}
          onSuccess={() => { setRedirecting(true); routeAfterLogin(); }}
        />
      )}
    </div>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Registration failed");
        setLoading(false);
        return;
      }
      const { signIn } = await import("next-auth/react");
      await signIn("credentials", {
        email,
        password,
        redirect: true,
        callbackUrl: "/dashboard",
      });
    } catch {
      alert("Registration failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center space-y-1">
        <Image src="/logo.png" alt="Veritas" width={44} height={44} className="mx-auto rounded-full mb-3" style={{ filter: "brightness(1.4)" }} />
        <h2 className="text-2xl font-bold text-white">Create an account</h2>
        <p className="text-sm text-white/60">Start verifying your research participants</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-name" className="text-white/80">Full Name</Label>
        <Input
          id="reg-name"
          placeholder="Dr. Jane Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-white/40 focus-visible:ring-white/20"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-email" className="text-white/80">Email</Label>
        <Input
          id="reg-email"
          type="email"
          placeholder="researcher@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-white/40 focus-visible:ring-white/20"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-password" className="text-white/80">Password</Label>
        <Input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-white/40 focus-visible:ring-white/20"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full h-9 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur text-white font-medium transition-all border border-white/20 disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-sm text-white/50">
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} className="text-white/80 underline hover:text-white">
          Sign in
        </button>
      </p>
    </form>
  );
}

export default function Home() {
  const [modal, setModal] = useState<"login" | "register" | null>(null);
  const [auroraOpacity, setAuroraOpacity] = useState(0);

  useEffect(() => {
    // Globe launch: 0.5s delay + 2.2s animation
    // Start fading smoke in partway through the globe animation so they arrive together
    const timer = setTimeout(() => {
      let start: number | null = null;
      const fadeDuration = 2200; // match globe animation duration
      const animate = (ts: number) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / fadeDuration, 1);
        setAuroraOpacity(progress);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-dvh max-h-dvh flex flex-col overflow-hidden fixed inset-0 bg-black">
      {/* Logo */}
      <Link href="/" className="absolute top-6 left-6 z-[45] flex items-center gap-2.5">
        <Image
          src="/logo.png"
          alt="Veritas"
          width={36}
          height={36}
          priority
          className=""
          style={{ filter: "brightness(1.4)" }}
        />
        <span className="text-white font-semibold text-lg tracking-tight">Veritas</span>
      </Link>

      {/* Hero + Globe */}
      <main className="flex-1 relative overflow-hidden">
        {/* Dither background — full screen, scaled up to avoid edge clipping */}
        <div className="absolute pointer-events-none z-[1] opacity-35" style={{ inset: "-10%", width: "120%", height: "120%" }}>
          <Dither
            waveSpeed={0.05}
            waveFrequency={3}
            waveAmplitude={0.3}
            waveColor={[0.4, 0.4, 0.4]}
            colorNum={4}
            pixelSize={2}
            enableMouseInteraction={false}
          />
        </div>

        {/* Balatro liquid smoke — aligned with globe position */}
        <div
          className="absolute inset-0 pointer-events-none z-[4] overflow-hidden"
          style={{ opacity: auroraOpacity, transition: "opacity 2s" }}
        >
          <div
            style={{
              width: "1350px",
              height: "1350px",
              position: "absolute",
              top: "50%",
              right: "28%",
              transform: "translate(50%, -50%)",
              opacity: 0.75,
              maskImage: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.4) 38%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.2) 65%, transparent 78%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.4) 38%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.2) 65%, transparent 78%)",
            }}
          >
            <Balatro
              isRotate={false}
              mouseInteraction={true}
              pixelFilter={6969}
              color1="#1a3a5aff"
              color2="#4a8abcff"
              color3="#0d2030ff"
              spinRotation={-2.0}
              spinSpeed={7.0}
              contrast={1.5}
              lighting={0.5}
              spinAmount={0.25}
              spinEase={1.0}
            />
          </div>
        </div>

        {/* Globe — right of center, behind text */}
        <div className="absolute inset-0 z-[20] flex items-center justify-end pointer-events-none" style={{ paddingRight: "28%" }}>
          <div className="pointer-events-auto">
            <GlobeWrapper />
          </div>
        </div>

        {/* Text — left side, on top of globe */}
        <div className="absolute inset-0 z-[40] flex items-center pointer-events-none">
          <div className="w-full max-w-7xl mx-auto px-8 sm:px-16">
            <div className="pointer-events-auto space-y-8 max-w-xl">
              <h1
                className="text-5xl sm:text-7xl font-bold tracking-tight text-white text-left opacity-0 animate-[fadeSlideUp_1.2s_ease-out_1.4s_forwards]"
              >
                Trust your research data.
              </h1>

              <p className="text-lg sm:text-xl font-normal text-white/70 leading-relaxed max-w-md opacity-0 animate-[fadeSlideUp_1.2s_ease-out_1.6s_forwards]">
                Cryptographic proof-of-personhood with AI-powered quality scoring
                to eliminate fraud from clinical research.
              </p>

              <div className="flex items-center gap-3 opacity-0 animate-[fadeSlideUp_1.2s_ease-out_2.0s_forwards]">
                <button
                  onClick={() => setModal("login")}
                  className="h-10 px-6 rounded-full text-sm font-medium text-black bg-white/90 hover:bg-white backdrop-blur-xl border border-white/20 shadow-lg shadow-white/5 transition-all"
                >
                  Researcher Login
                </button>
                <Link
                  href="/study"
                  className="h-10 px-6 rounded-full text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all inline-flex items-center"
                >
                  Browse Studies
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Logo loop — bottom right */}
      <div className="fixed bottom-6 right-6 z-[40] flex flex-col items-end gap-1.5 opacity-0 animate-[fadeSlideUp_1.2s_ease-out_2.4s_forwards]">
        <span className="text-[11px] text-white/30 tracking-wide whitespace-nowrap">built with love at catapult26</span>
        <LogoLoop
          logos={[
            { src: "https://cdn.simpleicons.org/docker/white", title: "Docker" },
            { src: "https://cdn.simpleicons.org/vercel/white", title: "Vercel" },
            { src: "https://cdn.simpleicons.org/supabase/white", title: "Supabase" },
            { src: "https://cdn.simpleicons.org/sentry/white", title: "Sentry" },
            { src: "https://cdn.simpleicons.org/react/white", title: "React" },
            { src: "https://cdn.simpleicons.org/nextdotjs/white", title: "Next.js" },
            { src: "https://cdn.simpleicons.org/typescript/white", title: "TypeScript" },
            { src: "https://cdn.simpleicons.org/tailwindcss/white", title: "Tailwind" },
          ]}
          speed={30}
          direction="left"
          width={280}
          logoHeight={18}
          gap={28}
          pauseOnHover={false}
          fadeOut
          ariaLabel="Technology stack"
        />
      </div>

      {/* Bottom left links */}
      <div className="fixed bottom-6 left-6 z-[40] opacity-0 animate-[fadeSlideUp_1.2s_ease-out_2.4s_forwards]">
        <span className="text-sm text-white/60 tracking-wide whitespace-nowrap">check out our github and devpost</span>
      </div>

      {/* Glass overlays */}
      <GlassOverlay open={modal === "login"} onClose={() => setModal(null)}>
        <LoginForm onSwitch={() => setModal("register")} />
      </GlassOverlay>

      <GlassOverlay open={modal === "register"} onClose={() => setModal(null)}>
        <RegisterForm onSwitch={() => setModal("login")} />
      </GlassOverlay>
    </div>
  );
}
