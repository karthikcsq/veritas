"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PublicStudy {
  id: string;
  title: string;
  description: string;
  compensationUsd: number;
  questionCount: number;
  worldIdAction: string;
}

interface RpSignatureResponse {
  app_id: string;
  rp_id: string;
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
}

export default function StudyEnrollPage() {
  const params = useParams<{ studyId: string }>();
  const router = useRouter();
  const studyId = params.studyId;

  const [study, setStudy] = useState<PublicStudy | null>(null);
  const [loadingStudy, setLoadingStudy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [loadingVerification, setLoadingVerification] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);

  useEffect(() => {
    async function loadStudy() {
      try {
        const response = await fetch(`/api/studies/${studyId}/public`);
        if (!response.ok) {
          throw new Error("Failed to load study");
        }

        const payload = (await response.json()) as { study: PublicStudy };
        setStudy(payload.study);
      } catch (err) {
        console.error(err);
        setError("Could not load this study.");
      } finally {
        setLoadingStudy(false);
      }
    }

    if (studyId) {
      void loadStudy();
    }
  }, [studyId]);

  async function startVerification() {
    if (!study) return;

    setLoadingVerification(true);
    setError(null);

    try {
      const signatureResponse = await fetch("/api/world-id/rp-signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: study.worldIdAction }),
      });

      if (!signatureResponse.ok) {
        throw new Error("Could not initialize World ID verification");
      }

      const rpSignature = (await signatureResponse.json()) as RpSignatureResponse;
      setAppId(rpSignature.app_id);
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
      setError("Failed to start verification. Please try again.");
    } finally {
      setLoadingVerification(false);
    }
  }

  async function handleVerify(result: IDKitResult) {
    const response = await fetch(`/api/studies/${studyId}/enroll`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idkitResponse: result,
      }),
    });

    if (!response.ok) {
      throw new Error("Backend verification failed");
    }
  }

  function handleSuccess() {
    router.push(`/study/${studyId}/survey`);
  }

  if (loadingStudy) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading study...</p>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
        <p className="text-sm text-destructive">{error ?? "Study not found."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto h-10 w-10 rounded-lg bg-primary flex items-center justify-center mb-2">
            <span className="text-primary-foreground font-bold">V</span>
          </div>
          <CardTitle className="text-2xl">{study.title}</CardTitle>
          <CardDescription className="mt-2">
            {study.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Study info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">
                ${study.compensationUsd}
              </div>
              <div className="text-sm text-muted-foreground">Compensation</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">
                {study.questionCount}
              </div>
              <div className="text-sm text-muted-foreground">Questions</div>
            </div>
          </div>

          {/* Verification info */}
          <div className="rounded-lg border border-dashed p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">World ID Required</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              This study uses World ID to verify that each participant is a
              unique real person. Your identity remains completely anonymous — no
              personal information is stored.
            </p>
          </div>

          {/* CTA */}
          <Button
            size="lg"
            className="w-full"
            onClick={startVerification}
            disabled={loadingVerification}
          >
            Verify with World ID to Enroll
          </Button>
          {error ? (
            <p className="text-sm text-center text-destructive">{error}</p>
          ) : null}

          {appId && rpContext ? (
            <IDKitRequestWidget
              open={widgetOpen}
              onOpenChange={setWidgetOpen}
              app_id={appId}
              action={study.worldIdAction}
              rp_context={rpContext}
              allow_legacy_proofs={true}
              preset={orbLegacy()}
              environment={process.env.NODE_ENV === "development" ? "staging" : "production"}
              handleVerify={handleVerify}
              onSuccess={handleSuccess}
              onError={() => {
                setError("World ID verification was not completed.");
              }}
            />
          ) : null}

          <p className="text-xs text-center text-muted-foreground">
            By enrolling, you agree to answer all questions honestly. Your
            responses will be evaluated for quality.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
