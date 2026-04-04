"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { orbLegacy, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const IDKitRequestWidget = dynamic(
  () => import("@worldcoin/idkit").then((mod) => mod.IDKitRequestWidget),
  { ssr: false },
);

interface RpSignatureResponse {
  app_id: `app_${string}`;
  rp_id: string;
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
}

const worldIdEnvironment =
  process.env.NEXT_PUBLIC_WORLD_ID_ENV === "staging"
    ? "staging"
    : "production";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingWorldId, setLoadingWorldId] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [widgetOpen, setWidgetOpen] = useState(false);
  const appId = process.env['NEXT_PUBLIC_WORLD_APP_ID'] as `app_${string}`;
  // const [appId, setAppId] = useState<`app_${string}` | null>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);

  const orbPreset = useMemo(() => orbLegacy(), []);

  async function routeAfterLogin() {
    const session = await getSession();
    const requiresOnboarding = Boolean(
      (session?.user as { requiresOnboarding?: boolean } | undefined)
        ?.requiresOnboarding,
    );
    window.location.assign(requiresOnboarding ? "/auth/onboarding" : "/dashboard");
  }

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

  async function startWorldIdLogin() {
    setLoadingWorldId(true);
    setError(null);

    try {
      const response = await fetch("/api/world-id/rp-signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify-account" }),
      });

      if (!response.ok) {
        throw new Error("Could not initialize World ID login");
      }

      const rpSignature = (await response.json()) as RpSignatureResponse;
      console.log(rpSignature)
      // setAppId(rpSignature.app_id);
      setRpContext({
        rp_id: rpSignature.rp_id,
        nonce: rpSignature.nonce,
        created_at: rpSignature.created_at,
        expires_at: rpSignature.expires_at,
        signature: rpSignature.sig,
      });
      setWidgetOpen(true);
    } catch (err) {
      console.error(err);
      setError("Failed to start World ID login.");
    } finally {
      setLoadingWorldId(false);
    }
  }

  async function handleVerify(result: IDKitResult) {
    const authResult = await signIn("world-id", {
      idkitResponse: JSON.stringify(result),
      redirect: false,
      callbackUrl: "/dashboard",
    });

    if (authResult?.error) {
      throw new Error("World ID sign-in failed");
    }
  }

  async function handleSuccess() {
    await routeAfterLogin();
  }

  console.log(appId, rpContext);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-10 w-10 rounded-lg bg-primary flex items-center justify-center mb-2">
            <span className="text-primary-foreground font-bold">V</span>
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your researcher account</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4"
            onClick={startWorldIdLogin}
            disabled={loadingWorldId}
          >
            {loadingWorldId ? "Starting World ID..." : "Continue with World ID"}
          </Button>
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
            <p className="mt-4 text-sm text-center text-destructive">{error}</p>
          ) : null}

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" className="underline text-foreground">
              Register
            </Link>
          </div>
        </CardContent>
      </Card>

      
      {appId && rpContext ? (
        <IDKitRequestWidget
          open={widgetOpen}
          onOpenChange={setWidgetOpen}
          app_id={appId}
          action="verify-account"
          rp_context={rpContext}
          allow_legacy_proofs={true}
          preset={orbPreset}
          environment={worldIdEnvironment}
          handleVerify={handleVerify}
          onSuccess={handleSuccess}
          onError={(err) => {
            console.error("IDKit error:", err);
            const errorCode =
              typeof err === "object" && err !== null && "errorCode" in err
                ? String((err as { errorCode?: unknown }).errorCode ?? err)
                : String(err);
            setError(`World ID verification failed: ${errorCode}`);
          }}
        />
      ) : null}
    </div>
  );
}
