"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
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

function enrollmentKey(studyId: string) {
  return `veritas_enrollment_${studyId}`;
}

export default function StudyEnrollPage() {
  const params = useParams<{ studyId: string }>();
  const router = useRouter();
  const studyId = params.studyId;

  const [study, setStudy] = useState<PublicStudy | null>(null);
  const [loadingStudy, setLoadingStudy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  // Auth gate — redirect to login if no participant session
  useEffect(() => {
    const stored = localStorage.getItem("veritas_participant");
    if (!stored) {
      router.replace(`/study/login?redirect=/study/${studyId}`);
    }
  }, [router, studyId]);

  // Restore existing enrollment from localStorage, verify it still exists
  useEffect(() => {
    const stored = localStorage.getItem(enrollmentKey(studyId));
    if (stored) {
      // Verify the enrollment still exists on the server
      fetch(`/api/enrollments/${stored}/responses`)
        .then((res) => {
          if (res.ok) {
            setEnrollmentId(stored);
          } else {
            // Enrollment was deleted, clear stale data
            localStorage.removeItem(enrollmentKey(studyId));
          }
        })
        .catch(() => {
          localStorage.removeItem(enrollmentKey(studyId));
        });
    }
  }, [studyId]);

  // Load study details
  useEffect(() => {
    if (!studyId) return;
    fetch(`/api/studies/${studyId}/public`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load study");
        return res.json();
      })
      .then((payload: { study: PublicStudy }) => setStudy(payload.study))
      .catch(() => setError("Could not load this study."))
      .finally(() => setLoadingStudy(false));
  }, [studyId]);

  async function handleEnroll() {
    const raw = localStorage.getItem("veritas_participant");
    if (!raw) { router.replace(`/study/login?redirect=/study/${studyId}`); return; }
    const { participantId } = JSON.parse(raw) as { participantId: string };

    setEnrolling(true);
    setError(null);
    try {
      const res = await fetch(`/api/studies/${studyId}/participant-enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError((data as { error?: string }).error ?? "Enrollment failed");
        return;
      }
      const data = await res.json() as { enrollmentId: string };
      localStorage.setItem(enrollmentKey(studyId), data.enrollmentId);
      setEnrollmentId(data.enrollmentId);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setEnrolling(false);
    }
  }

  function handleStartSurvey() {
    router.push(`/study/${studyId}/survey?enrollmentId=${enrollmentId}`);
  }

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
          <Image
            src="/logo.png"
            alt="Veritas"
            width={44}
            height={44}
            className="mx-auto mb-2"
            style={{ filter: "brightness(1.4)" }}
          />
          <CardTitle className="text-2xl">{study.title}</CardTitle>
          <CardDescription className="mt-2">{study.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">${study.compensationUsd}</div>
              <div className="text-sm text-muted-foreground">Compensation</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">{study.questionCount}</div>
              <div className="text-sm text-muted-foreground">Questions</div>
            </div>
          </div>

          {isEnrolled ? (
            <>
              <div className="rounded-lg border border-dashed p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Enrolled</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  You are enrolled in this study. Click below to begin.
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
                  <Badge variant="outline">Not Enrolled</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  You are verified as a unique participant. Click below to enroll
                  and begin this study.
                </p>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={handleEnroll}
                disabled={enrolling}
              >
                {enrolling ? "Enrolling..." : "Enroll in Study"}
              </Button>
            </>
          )}

          {error && (
            <p className="text-sm text-center text-destructive">{error}</p>
          )}

          <p className="text-xs text-center text-muted-foreground">
            By enrolling, you agree to answer all questions honestly. Your
            responses will be evaluated for quality.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
