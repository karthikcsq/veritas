"use client";

import { useState, useCallback, useRef, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";

const DEFAULT_APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}` | undefined;

async function getRpContext(action: string): Promise<{ rp_id: string } & RpContext> {
  const res = await fetch("/api/world-id/rp-signature", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error("Failed to get RP signature");
  const rpSig = await res.json();
  return {
    rp_id: rpSig.rp_id,
    nonce: rpSig.nonce,
    created_at: rpSig.created_at,
    expires_at: rpSig.expires_at,
    signature: rpSig.sig,
  };
}

function ParticipantLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/study";

  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const rpContextRef = useRef<({ rp_id: string } & RpContext) | null>(null);
  const participantIdRef = useRef<string | null>(null);
  const preset = useMemo(() => orbLegacy(), []);

  // Already logged in — skip straight to destination
  useEffect(() => {
    const stored = localStorage.getItem("veritas_participant");
    if (stored) router.replace(redirect);
  }, [router, redirect]);

  const startVerification = async () => {
    if (!DEFAULT_APP_ID) { setError("App not configured"); return; }
    setStarting(true);
    setError(null);
    try {
      const ctx = await getRpContext("verify-account");
      rpContextRef.current = ctx;
      setRpContext(ctx);
      setOpen(true);
    } catch {
      setError("Failed to start verification. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  const handleVerify = useCallback(async (result: IDKitResult) => {
    const ctx = rpContextRef.current;
    if (!ctx) throw new Error("Missing RP context");

    const verifyRes = await fetch("/api/verify-proof", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rp_id: ctx.rp_id, idkitResponse: result }),
    });
    if (!verifyRes.ok) throw new Error("World ID verification failed");
    const { nullifier } = await verifyRes.json();

    const loginRes = await fetch("/api/participant/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nullifier }),
    });
    if (!loginRes.ok) throw new Error("Participant login failed");
    const { participantId } = await loginRes.json();
    participantIdRef.current = participantId;
  }, []);

  const handleSuccess = () => {
    const participantId = participantIdRef.current;
    if (participantId) {
      localStorage.setItem("veritas_participant", JSON.stringify({ participantId }));
    }
    router.replace(redirect);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) { rpContextRef.current = null; setRpContext(null); }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center py-16">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-60 -left-60 h-[800px] w-[800px] rounded-full bg-[#1a5276]/20 blur-[150px]" />
        <div className="absolute top-1/4 -right-40 h-[700px] w-[700px] rounded-full bg-[#2874a6]/15 blur-[130px]" />
        <div className="absolute -bottom-60 left-1/4 h-[700px] w-[700px] rounded-full bg-[#1b4f72]/12 blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div
          className="rounded-[26px] border border-white/20 bg-black/40 backdrop-blur-3xl shadow-2xl p-10"
          style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1), 0 20px 60px rgba(0,0,0,0.3)" }}
        >
          {/* Header */}
          <div className="text-center mb-8 space-y-2">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="Veritas"
                width={48}
                height={48}
                className="mx-auto mb-4 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                style={{ filter: "brightness(1.4)" }}
              />
            </Link>
            <h1 className="text-2xl font-bold text-white">Participant Login</h1>
            <p className="text-sm text-white/60">
              Verify your identity to access clinical studies
            </p>
          </div>

          {/* World ID button */}
          <div className="space-y-4">
            <button
              onClick={startVerification}
              disabled={starting}
              className="w-full h-11 rounded-lg bg-white/90 hover:bg-white text-black font-semibold transition-all border border-white/20 shadow-lg shadow-white/5 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="4" fill="currentColor" />
              </svg>
              {starting ? "Preparing..." : "Verify with World ID"}
            </button>

            {error && (
              <p className="text-sm text-center text-red-400">{error}</p>
            )}

            <p className="text-center text-xs text-white/40 leading-relaxed">
              No personal information is stored. World ID proves you are a unique
              real person without revealing your identity.
            </p>
          </div>

          {/* Footer link */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-white/50">
              Are you a researcher?{" "}
              <Link
                href="/"
                className="text-[#5dade2] hover:text-[#3498db] transition-colors underline underline-offset-2"
              >
                Researcher Login
              </Link>
            </p>
          </div>
        </div>
      </div>

      {DEFAULT_APP_ID && rpContext && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={onOpenChange}
          app_id={DEFAULT_APP_ID}
          action="verify-account"
          rp_context={rpContext}
          allow_legacy_proofs
          preset={preset}
          handleVerify={handleVerify}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

export default function ParticipantLoginPage() {
  return (
    <Suspense>
      <ParticipantLoginContent />
    </Suspense>
  );
}
