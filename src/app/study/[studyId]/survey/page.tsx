"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  QuestionType,
  QuestionDependency,
  QuestionConfig,
  ValidateResponseResponse,
} from "@/types";

interface SurveyQuestion {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  options?: string[];
  required: boolean;
  config?: QuestionConfig | null;
  dependsOn?: QuestionDependency | null;
}

function evaluateDependency(
  dep: QuestionDependency,
  answers: Record<string, string>
): boolean {
  const answer = answers[dep.questionId];
  if (answer === undefined || answer === "") return false;

  switch (dep.condition) {
    case "equals":
      return answer === String(dep.value);
    case "not_equals":
      return answer !== String(dep.value);
    case "includes": {
      try {
        const selected: string[] = JSON.parse(answer);
        return Array.isArray(dep.value)
          ? (dep.value as string[]).some((v) => selected.includes(v))
          : selected.includes(String(dep.value));
      } catch {
        return answer.includes(String(dep.value));
      }
    }
    case "not_includes": {
      try {
        const selected: string[] = JSON.parse(answer);
        return Array.isArray(dep.value)
          ? !(dep.value as string[]).some((v) => selected.includes(v))
          : !selected.includes(String(dep.value));
      } catch {
        return !answer.includes(String(dep.value));
      }
    }
    case "gte":
      return Number(answer) >= Number(dep.value);
    case "lte":
      return Number(answer) <= Number(dep.value);
    case "between": {
      const [min, max] = dep.value as [number, number];
      const num = Number(answer);
      return num >= min && num <= max;
    }
    default:
      return true;
  }
}

interface ValidityState {
  score: number;
  explanation: string;
  missedParts: string[];
  dismissed: boolean;
}

function highlightMissedParts(
  prompt: string,
  missedParts: string[]
): React.ReactNode {
  if (missedParts.length === 0) return prompt;

  const sortedParts = [...missedParts].sort((a, b) => {
    const idxA = prompt.toLowerCase().indexOf(a.toLowerCase());
    const idxB = prompt.toLowerCase().indexOf(b.toLowerCase());
    return idxA - idxB;
  });

  const segments: React.ReactNode[] = [];
  let cursor = 0;

  for (const part of sortedParts) {
    const idx = prompt.toLowerCase().indexOf(part.toLowerCase(), cursor);
    if (idx === -1) continue;

    if (idx > cursor) {
      segments.push(prompt.slice(cursor, idx));
    }
    segments.push(
      <mark
        key={idx}
        className="bg-amber-500/30 text-amber-200 rounded-sm px-0.5 underline decoration-amber-400 decoration-2 underline-offset-2"
      >
        {prompt.slice(idx, idx + part.length)}
      </mark>
    );
    cursor = idx + part.length;
  }

  if (cursor < prompt.length) {
    segments.push(prompt.slice(cursor));
  }

  return <>{segments}</>;
}

interface QuestionPage {
  root: SurveyQuestion;
  dependents: SurveyQuestion[];
}

export default function SurveyPage() {
  const { studyId } = useParams<{ studyId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const enrollmentId = searchParams.get("enrollmentId");

  // Auth gate — redirect to login if no participant session
  useEffect(() => {
    const stored = localStorage.getItem("veritas_participant");
    if (!stored) {
      router.replace(`/study/login?redirect=/study/${studyId}`);
    }
  }, [router, studyId]);

  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeStarted, setTimeStarted] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validity, setValidity] = useState<Record<string, ValidityState>>({});
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  // Request location on mount for response origin tracking
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => {
        // Hardcoded for demo — in production this would reverse-geocode the coords
        setLocationLabel("San Francisco, CA");
      },
      () => {
        // Permission denied or unavailable — silently skip
      },
      { timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    async function loadQuestions() {
      try {
        const res = await fetch(`/api/studies/${studyId}/public`);
        if (res.ok) {
          const data = await res.json();
          const qs = (data.study.questions ?? []).map(
            (q: SurveyQuestion) => ({
              ...q,
              options:
                typeof q.options === "string"
                  ? JSON.parse(q.options as unknown as string)
                  : q.options,
              config:
                typeof q.config === "string"
                  ? JSON.parse(q.config as unknown as string)
                  : q.config,
              dependsOn:
                typeof q.dependsOn === "string"
                  ? JSON.parse(q.dependsOn as unknown as string)
                  : q.dependsOn,
            })
          );
          setQuestions(qs);
          if (qs.length > 0) {
            setTimeStarted({ [qs[0].id]: Date.now() });
          }
        }
      } finally {
        setLoadingQuestions(false);
      }
    }
    if (studyId) loadQuestions();
  }, [studyId]);

  const pages: QuestionPage[] = useMemo(() => {
    const rootQuestions = questions.filter((q) => !q.dependsOn);
    return rootQuestions.map((root) => {
      const dependents = questions.filter(
        (q) =>
          q.dependsOn && q.dependsOn.questionId === root.id
      );
      return { root, dependents };
    });
  }, [questions]);

  const currentPage = pages[currentPageIndex];
  const visiblePageQuestions: SurveyQuestion[] = useMemo(() => {
    if (!currentPage) return [];
    const result: SurveyQuestion[] = [currentPage.root];
    for (const dep of currentPage.dependents) {
      if (dep.dependsOn && evaluateDependency(dep.dependsOn, answers)) {
        result.push(dep);
      }
    }
    return result;
  }, [currentPage, answers]);

  const isLastPage = currentPageIndex === pages.length - 1;
  const progress =
    pages.length > 0
      ? ((currentPageIndex + 1) / pages.length) * 100
      : 0;

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (validity[questionId]) {
      setValidity((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  }

  function advanceToNext() {
    if (isLastPage) {
      submitResponses();
    } else {
      const nextPage = pages[currentPageIndex + 1];
      if (nextPage) {
        setTimeStarted((prev) => ({
          ...prev,
          [nextPage.root.id]: Date.now(),
        }));
      }
      setCurrentPageIndex((i) => i + 1);
    }
  }

  function getAllVisibleQuestions(): SurveyQuestion[] {
    const result: SurveyQuestion[] = [];
    for (const page of pages) {
      result.push(page.root);
      for (const dep of page.dependents) {
        if (dep.dependsOn && evaluateDependency(dep.dependsOn, answers)) {
          result.push(dep);
        }
      }
    }
    return result;
  }

  async function submitResponses() {
    if (!enrollmentId) {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    try {
      const now = Date.now();
      const allVisible = getAllVisibleQuestions();
      const responsePayload = allVisible.map((q) => ({
        questionId: q.id,
        value: answers[q.id] ?? "",
        timeSpentMs: now - (timeStarted[q.id] ?? now),
      }));

      const res = await fetch(
        `/api/enrollments/${enrollmentId}/responses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses: responsePayload }),
        }
      );

      if (res.ok) {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const validateAndProceed = useCallback(async () => {
    if (!currentPage) return;

    for (const q of visiblePageQuestions) {
      if (q.required && !answers[q.id]) return;
    }

    const textQs = visiblePageQuestions.filter(
      (q) =>
        (q.type === "LONG_TEXT" || q.type === "SHORT_TEXT") &&
        answers[q.id]
    );

    const needsValidation = textQs.find((q) => {
      const existing = validity[q.id];
      return !existing?.dismissed && !existing;
    });

    if (!needsValidation) {
      advanceToNext();
      return;
    }

    setValidating(true);
    try {
      const res = await fetch("/api/validate-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: needsValidation.prompt,
          answer: answers[needsValidation.id],
          questionType: needsValidation.type,
        }),
      });
      const data: ValidateResponseResponse = await res.json();

      if (data.score < 40) {
        setValidity((prev) => ({
          ...prev,
          [needsValidation.id]: {
            score: data.score,
            explanation: data.explanation,
            missedParts: data.missedParts ?? [],
            dismissed: false,
          },
        }));
      } else {
        setValidity((prev) => ({
          ...prev,
          [needsValidation.id]: {
            score: data.score,
            explanation: "",
            missedParts: [],
            dismissed: true,
          },
        }));
        const remaining = textQs.filter((q) => {
          if (q.id === needsValidation.id) return false;
          const existing = validity[q.id];
          return !existing?.dismissed && !existing;
        });
        if (remaining.length === 0) {
          advanceToNext();
        }
      }
    } catch {
      advanceToNext();
    } finally {
      setValidating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    answers,
    currentPage,
    visiblePageQuestions,
    isLastPage,
    validity,
    pages,
    currentPageIndex,
    timeStarted,
    enrollmentId,
  ]);

  function dismissWarning(questionId: string) {
    setValidity((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], dismissed: true },
    }));
  }

  if (loadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <p className="text-sm text-white/50">Loading survey...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <p className="text-sm text-destructive">
          No questions found for this study.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-2xl">&#10003;</span>
            </div>
            <h2 className="text-xl font-bold text-white">
              Responses Submitted
            </h2>
            <p className="text-white/60">
              Thank you for participating. Your responses are being evaluated
              for quality scoring. Compensation will be processed once the
              study is complete.
            </p>
            <Link href="/study">
              <Button
                variant="outline"
                className="mt-2 border-white/10 text-white/70 hover:bg-white/10"
              >
                Browse Studies
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allPageAnswered = visiblePageQuestions.every(
    (q) => !q.required || !!answers[q.id]
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      <div className="w-full max-w-lg space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-white/50">
            <span>
              Question {currentPageIndex + 1} of {pages.length}
            </span>
            <div className="flex items-center gap-3">
              {locationLabel && (
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="none" className="shrink-0">
                    <path d="M5 0C2.79 0 1 1.79 1 4c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4zm0 5.5A1.5 1.5 0 1 1 5 2.5a1.5 1.5 0 0 1 0 3z" fill="currentColor"/>
                  </svg>
                  {locationLabel}
                </span>
              )}
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[#3498db] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {visiblePageQuestions.map((question) => {
          const currentValidity = validity[question.id];
          const isDependent = !!question.dependsOn;

          return (
            <Card
              key={question.id}
              className={
                isDependent ? "ml-4 border-l-2 border-l-[#3498db]/30" : ""
              }
            >
              <CardHeader>
                <CardTitle className="text-lg text-white">
                  {currentValidity &&
                  !currentValidity.dismissed &&
                  currentValidity.missedParts.length > 0
                    ? highlightMissedParts(
                        question.prompt,
                        currentValidity.missedParts
                      )
                    : question.prompt}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {question.type === "SCALE" &&
                  (() => {
                    const sc = question.config?.scale ?? {
                      min: 1,
                      max: 10,
                    };
                    const step = sc.step ?? 1;
                    const values: number[] = [];
                    for (let n = sc.min; n <= sc.max; n += step)
                      values.push(n);
                    return (
                      <div className="space-y-2">
                        <div className="flex gap-2 flex-wrap">
                          {values.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() =>
                                setAnswer(question.id, String(n))
                              }
                              className={`h-10 w-10 rounded-lg border border-white/10 text-sm font-medium transition-colors ${
                                answers[question.id] === String(n)
                                  ? "bg-[#2874a6] text-white border-[#3498db]"
                                  : "text-white/70 hover:bg-white/10"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        {(sc.minLabel || sc.maxLabel) && (
                          <div className="flex justify-between text-xs text-white/40">
                            <span>{sc.minLabel ?? ""}</span>
                            <span>{sc.maxLabel ?? ""}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {question.type === "LONG_TEXT" && (
                  <div className="relative">
                    <textarea
                      className="w-full min-h-[120px] rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#3498db]"
                      placeholder="Type your answer..."
                      value={answers[question.id] || ""}
                      onChange={(e) =>
                        setAnswer(question.id, e.target.value)
                      }
                    />
                    {currentValidity && !currentValidity.dismissed && (
                      <div className="absolute -right-2 top-2 translate-x-full max-w-[200px] z-10">
                        <div className="relative bg-amber-500/15 backdrop-blur-sm border border-amber-500/30 rounded-xl rounded-tl-sm px-3 py-2 text-xs text-amber-200 shadow-lg">
                          <p className="font-medium leading-snug">
                            {currentValidity.score < 20
                              ? "Hmm, this doesn't seem related to the question. Mind taking another look?"
                              : "Heads up: your answer might not fully cover what's being asked."}
                          </p>
                          <p className="mt-1 text-amber-300/60 leading-snug">
                            {currentValidity.explanation}
                          </p>
                          <button
                            className="mt-1.5 text-[10px] text-amber-400/70 hover:text-amber-300 underline underline-offset-2"
                            onClick={() => dismissWarning(question.id)}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {question.type === "SHORT_TEXT" && (
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#3498db]"
                      placeholder="Type your answer..."
                      value={answers[question.id] || ""}
                      onChange={(e) =>
                        setAnswer(question.id, e.target.value)
                      }
                    />
                    {currentValidity && !currentValidity.dismissed && (
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full max-w-[200px] z-10">
                        <div className="relative bg-amber-500/15 backdrop-blur-sm border border-amber-500/30 rounded-xl rounded-tl-sm px-3 py-2 text-xs text-amber-200 shadow-lg">
                          <p className="font-medium leading-snug">
                            {currentValidity.score < 20
                              ? "Hmm, this doesn't seem related to the question. Mind taking another look?"
                              : "Heads up: your answer might not fully cover what's being asked."}
                          </p>
                          <p className="mt-1 text-amber-300/60 leading-snug">
                            {currentValidity.explanation}
                          </p>
                          <button
                            className="mt-1.5 text-[10px] text-amber-400/70 hover:text-amber-300 underline underline-offset-2"
                            onClick={() => dismissWarning(question.id)}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {question.type === "MULTIPLE_CHOICE" &&
                  question.options && (
                    <div className="space-y-2">
                      {question.options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setAnswer(question.id, option)
                          }
                          className={`w-full text-left px-4 py-3 rounded-lg border border-white/10 text-sm transition-colors ${
                            answers[question.id] === option
                              ? "bg-[#2874a6] text-white border-[#3498db]"
                              : "text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}

                {question.type === "CHECKBOX" &&
                  question.options &&
                  (() => {
                    const selected: string[] = (() => {
                      try {
                        return JSON.parse(
                          answers[question.id] || "[]"
                        );
                      } catch {
                        return [];
                      }
                    })();
                    return (
                      <div className="space-y-2">
                        {question.options.map((option) => {
                          const isChecked = selected.includes(option);
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                const next = isChecked
                                  ? selected.filter(
                                      (s) => s !== option
                                    )
                                  : [...selected, option];
                                setAnswer(
                                  question.id,
                                  JSON.stringify(next)
                                );
                              }}
                              className={`w-full text-left px-4 py-3 rounded-lg border border-white/10 text-sm transition-colors flex items-center gap-3 ${
                                isChecked
                                  ? "bg-[#2874a6] text-white border-[#3498db]"
                                  : "text-white/70 hover:bg-white/10"
                              }`}
                            >
                              <span
                                className={`h-4 w-4 rounded border flex items-center justify-center text-xs ${
                                  isChecked
                                    ? "bg-white text-[#2874a6]"
                                    : "border-white/30"
                                }`}
                              >
                                {isChecked ? "\u2713" : ""}
                              </span>
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

              </CardContent>
            </Card>
          );
        })}

        <div className="flex justify-between pt-2">
          <Button
            variant="ghost"
            className="text-white/60 hover:text-white hover:bg-white/10"
            onClick={() =>
              setCurrentPageIndex(Math.max(0, currentPageIndex - 1))
            }
            disabled={currentPageIndex === 0}
          >
            Previous
          </Button>
          <Button
            className="bg-[#2874a6] hover:bg-[#3498db] text-white"
            onClick={validateAndProceed}
            disabled={!allPageAnswered || validating || submitting}
          >
            {validating
              ? "Checking..."
              : submitting
                ? "Submitting..."
                : isLastPage
                  ? "Submit"
                  : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
