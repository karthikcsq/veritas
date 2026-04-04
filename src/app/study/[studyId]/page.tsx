"use client";

import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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

const DEFAULT_APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}` | undefined;
const IS_DEV = process.env.NODE_ENV !== "production";

function enrollmentKey(studyId: string) {
  return `veritas_enrollment_${studyId}`;
}

async function getRpContext(action: string): Promise<{ rp_id: string } & RpContext> {
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

export default function StudyEnrollPage() {
  const params = useParams<{ studyId: string }>();
  const router = useRouter();
  const studyId = params.studyId;

  const [study, setStudy] = useState<PublicStudy | null>(null);
  const [loadingStudy, setLoadingStudy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const rpContextRef = useRef<RpContext | null>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const enrollmentIdRef = useRef<string | null>(null);

  const preset = useMemo(() => orbLegacy(), []);

  useEffect(() => {
    const stored = localStorage.getItem(enrollmentKey(studyId));
    if (stored) {
      setEnrollmentId(stored);
      return;
    }

    if (IS_DEV) {
      fetch(`/api/studies/${studyId}/dev-enroll`, { method: "POST" })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: { enrollmentId: string }) => {
          localStorage.setItem(enrollmentKey(studyId), data.enrollmentId);
          setEnrollmentId(data.enrollmentId);
        })
        .catch(() => {});
    }
  }, [studyId]);

  useEffect(() => {
    async function loadStudy() {
      try {
        const response = await fetch(`/api/studies/${studyId}/public`);
        if (!response.ok) throw new Error("Failed to load study");
        const payload = (await response.json()) as { study: PublicStudy };
        setStudy(payload.study);
      } catch (err) {
        console.error(err);
        setError("Could not load this study.");
      } finally {
        setLoadingStudy(false);
      }
    }

    if (studyId) void loadStudy();
  }, [studyId]);

  const verifyOnBackend = useCallback(
    async (result: IDKitResult) => {
      const response = await fetch(`/api/studies/${studyId}/enroll`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idkitResponse: result }),
      });

      if (!response.ok) throw new Error("Backend verification failed");

      const data = await response.json();
      enrollmentIdRef.current = data.enrollmentId;
    },
    [studyId],
  );

  const startVerification = async () => {
    if (!study || !DEFAULT_APP_ID) return;

    setStarting(true);
    setError(null);

    try {
      const ctx = await getRpContext(study.worldIdAction);
      rpContextRef.current = ctx;
      setRpContext(ctx);
      setOpen(true);
    } catch (e) {
      console.error(e);
      rpContextRef.current = null;
      setRpContext(null);
      setError("Failed to start verification. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  const handleVerificationSuccess = () => {
    const eid = enrollmentIdRef.current;
    if (eid) {
      localStorage.setItem(enrollmentKey(studyId), eid);
      setEnrollmentId(eid);
    }
  };

  const handleStartSurvey = () => {
    router.push(`/study/${studyId}/survey?enrollmentId=${enrollmentId}`);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      rpContextRef.current = null;
      setRpContext(null);
    }
  };

  if (loadingStudy) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading study...</p>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-destructive">{error ?? "Study not found."}</p>
      </div>
    );
  }

  const isEnrolled = Boolean(enrollmentId);

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
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

          {isEnrolled ? (
            <>
              <div className="rounded-lg border border-dashed p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Verified</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  You&apos;ve been verified with World ID. You can now begin the
                  survey.
                </p>
              </div>
              <Button size="lg" className="w-full" onClick={handleStartSurvey}>
                Start Survey
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-dashed p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">World ID Required</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  This study uses World ID to verify that each participant is a
                  unique real person. Your identity remains completely
                  anonymous — no personal information is stored.
                </p>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={startVerification}
                disabled={starting}
              >
                {starting ? "Preparing…" : "Verify with World ID"}
              </Button>
            </>
          )}

          {error ? (
            <p className="text-sm text-center text-destructive">{error}</p>
          ) : null}

          {DEFAULT_APP_ID && rpContext && study ? (
            <IDKitRequestWidget
              open={open}
              onOpenChange={onOpenChange}
              app_id={DEFAULT_APP_ID}
              action={study.worldIdAction}
              rp_context={rpContext}
              allow_legacy_proofs
              preset={preset}
              handleVerify={verifyOnBackend}
              onSuccess={handleVerificationSuccess}
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
