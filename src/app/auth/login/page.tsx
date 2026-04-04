"use client";

import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const rpContextRef = useRef<RpContext | null>(null);
  const verifyingRef = useRef(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);

  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}` | undefined;
  const preset = orbLegacy();

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

  // --- Email/password login ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    await routeAfterLogin();
  }

  // --- World ID login (matches reference pattern) ---
  const verifyOnBackend = useCallback(
    async (result: IDKitResult) => {
      if (verifyingRef.current) return;
      verifyingRef.current = true;

      const ctx = rpContextRef.current;
      if (!ctx) {
        verifyingRef.current = false;
        throw new Error("Missing RP context");
      }

      const response = await fetch("/api/verify-proof", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rp_id: ctx.rp_id,
          idkitResponse: result,
        }),
      });

      if (!response.ok) {
        throw new Error("Backend verification failed");
      }

      // Create a NextAuth session after proof verification
      const authResult = await signIn("world-id", {
        idkitResponse: JSON.stringify(result),
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (authResult?.error) {
        throw new Error("World ID sign-in failed");
      }
    },
    [],
  );

  const startWorldIdLogin = async () => {
    if (!appId) {
      setError("NEXT_PUBLIC_WORLD_APP_ID is not set");
      return;
    }

    setStarting(true);
    setError(null);
    try {
      const ctx = await getRpContext(DEFAULT_ACTION);
      rpContextRef.current = ctx;
      setRpContext(ctx);
      setOpen(true);
    } catch (e) {
      console.error(e);
      rpContextRef.current = null;
      setRpContext(null);
      setError("Failed to start World ID login.");
    } finally {
      setStarting(false);
    }
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      rpContextRef.current = null;
      verifyingRef.current = false;
      setRpContext(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-10 w-10 rounded-lg bg-primary flex items-center justify-center mb-2">
            <span className="text-primary-foreground font-bold">V</span>
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your researcher account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {appId ? (
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={startWorldIdLogin}
              disabled={starting}
            >
              {starting ? "Preparing…" : "Verify with World ID"}
            </Button>
          ) : (
            <p className="text-sm text-red-600 mb-4">
              Configure NEXT_PUBLIC_WORLD_APP_ID to enable World ID login.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="researcher@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          {error ? (
            <p className="mt-4 text-sm text-center text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="underline text-foreground"
            >
              Register
            </Link>
          </div>
        </CardContent>
      </Card>

      {rpContext ? (
        <IDKitRequestWidget
          open={open}
          onOpenChange={onOpenChange}
          app_id={appId!}
          action={DEFAULT_ACTION}
          rp_context={rpContext}
          allow_legacy_proofs
          preset={preset}
          handleVerify={verifyOnBackend}
          onSuccess={() => {
            routeAfterLogin();
          }}
        />
      ) : null}
    </div>
  );
}
