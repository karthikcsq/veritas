"use client";

import { useEffect, useState } from "react";
import { getSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function guardOnboardingRoute() {
      const session = await getSession();
      const requiresOnboarding = Boolean(
        (session?.user as { requiresOnboarding?: boolean } | undefined)
          ?.requiresOnboarding
      );
      if (!session?.user) {
        window.location.replace("/auth/login");
        return;
      }
      if (!requiresOnboarding) {
        window.location.replace("/dashboard");
      }
    }

    void guardOnboardingRoute();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Could not save your profile. Please try again.");
      return;
    }

    await getSession();
    window.location.assign("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-10 w-10 rounded-lg bg-primary flex items-center justify-center mb-2">
            <span className="text-primary-foreground font-bold">V</span>
          </div>
          <CardTitle className="text-2xl">Complete your profile</CardTitle>
          <CardDescription>
            Add your display name to finish setting up your researcher account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                placeholder="Dr. Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Continue to Dashboard"}
            </Button>
          </form>
          {error ? (
            <p className="mt-4 text-sm text-center text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
