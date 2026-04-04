"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuestionType, QuestionDependency, QuestionConfig, ValidateResponseResponse } from "@/types";

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

function evaluateDependency(dep: QuestionDependency, answers: Record<string, string>): boolean {
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

function highlightMissedParts(prompt: string, missedParts: string[]): React.ReactNode {
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
        className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 underline decoration-yellow-500 decoration-2 underline-offset-2"
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

/** A page groups a root question with all its direct dependents. */
interface QuestionPage {
  root: SurveyQuestion;
  dependents: SurveyQuestion[];
}

export default function SurveyPage() {
  const { studyId } = useParams<{ studyId: string }>();
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get("enrollmentId");

  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeStarted, setTimeStarted] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validity, setValidity] = useState<Record<string, ValidityState>>({});

  useEffect(() => {
    async function loadQuestions() {
      try {
        const res = await fetch(`/api/studies/${studyId}/public`);
        if (res.ok) {
          const data = await res.json();
          const qs = (data.study.questions ?? []).map((q: SurveyQuestion) => ({
            ...q,
            options: typeof q.options === "string" ? JSON.parse(q.options as unknown as string) : q.options,
            config: typeof q.config === "string" ? JSON.parse(q.config as unknown as string) : q.config,
            dependsOn: typeof q.dependsOn === "string" ? JSON.parse(q.dependsOn as unknown as string) : q.dependsOn,
          }));
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

  // Group questions into pages: root questions + their dependents
  const pages: QuestionPage[] = useMemo(() => {
    const rootQuestions = questions.filter((q) => !q.dependsOn);
    return rootQuestions.map((root) => {
      const dependents = questions.filter(
        (q) => q.dependsOn && q.dependsOn.questionId === `order_${root.order}`
      );
      return { root, dependents };
    });
  }, [questions]);

  // Visible questions on the current page (root + visible dependents)
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
  const progress = pages.length > 0 ? ((currentPageIndex + 1) / pages.length) * 100 : 0;

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
        setTimeStarted((prev) => ({ ...prev, [nextPage.root.id]: Date.now() }));
      }
      setCurrentPageIndex((i) => i + 1);
    }
  }

  // Collect all visible questions across all pages for submission
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

      const res = await fetch(`/api/enrollments/${enrollmentId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: responsePayload }),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const validateAndProceed = useCallback(async () => {
    if (!currentPage) return;

    // Check that all required visible questions on this page have answers
    for (const q of visiblePageQuestions) {
      if (q.required && !answers[q.id]) return;
    }

    // Find the first text question on this page that needs LLM validation
    const textQs = visiblePageQuestions.filter(
      (q) => (q.type === "LONG_TEXT" || q.type === "SHORT_TEXT") && answers[q.id]
    );

    // Check if any text question needs validation
    const needsValidation = textQs.find((q) => {
      const existing = validity[q.id];
      return !existing?.dismissed && !existing;
    });

    if (!needsValidation) {
      // All validated or non-text, proceed
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
        // Mark as passed so we don't re-validate
        setValidity((prev) => ({
          ...prev,
          [needsValidation.id]: {
            score: data.score,
            explanation: "",
            missedParts: [],
            dismissed: true,
          },
        }));
        // Check if there are more text questions to validate
        const remaining = textQs.filter((q) => {
          if (q.id === needsValidation.id) return false;
          const existing = validity[q.id];
          return !existing?.dismissed && !existing;
        });
        if (remaining.length === 0) {
          advanceToNext();
        }
        // If remaining, the user clicks Next again to validate the next one
      }
    } catch {
      advanceToNext();
    } finally {
      setValidating(false);
    }
  }, [answers, currentPage, visiblePageQuestions, isLastPage, validity, pages, currentPageIndex, timeStarted, enrollmentId]);

  function dismissWarning(questionId: string) {
    setValidity((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], dismissed: true },
    }));
  }

  if (loadingQuestions) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading survey...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-destructive">No questions found for this study.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-green-600 text-2xl">&#10003;</span>
            </div>
            <h2 className="text-xl font-bold">Responses Submitted</h2>
            <p className="text-muted-foreground">
              Thank you for participating. Your responses are being evaluated
              for quality scoring. Compensation will be processed once the study
              is complete.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if all required visible questions on this page have answers
  const allPageAnswered = visiblePageQuestions.every(
    (q) => !q.required || !!answers[q.id]
  );

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Question {currentPageIndex + 1} of {pages.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {visiblePageQuestions.map((question) => {
          const currentValidity = validity[question.id];
          const isDependent = !!question.dependsOn;

          return (
            <Card key={question.id} className={isDependent ? "ml-4 border-l-4 border-l-primary/30" : ""}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {currentValidity && !currentValidity.dismissed && currentValidity.missedParts.length > 0
                    ? highlightMissedParts(question.prompt, currentValidity.missedParts)
                    : question.prompt}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {question.type === "SCALE" && (() => {
                  const sc = question.config?.scale ?? { min: 1, max: 10 };
                  const step = sc.step ?? 1;
                  const values: number[] = [];
                  for (let n = sc.min; n <= sc.max; n += step) values.push(n);
                  return (
                    <div className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        {values.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAnswer(question.id, String(n))}
                            className={`h-10 w-10 rounded-lg border text-sm font-medium transition-colors ${
                              answers[question.id] === String(n)
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      {(sc.minLabel || sc.maxLabel) && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{sc.minLabel ?? ""}</span>
                          <span>{sc.maxLabel ?? ""}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {question.type === "LONG_TEXT" && (
                  <textarea
                    className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Type your answer..."
                    value={answers[question.id] || ""}
                    onChange={(e) => setAnswer(question.id, e.target.value)}
                  />
                )}

                {question.type === "SHORT_TEXT" && (
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Type your answer..."
                    value={answers[question.id] || ""}
                    onChange={(e) => setAnswer(question.id, e.target.value)}
                  />
                )}

                {question.type === "MULTIPLE_CHOICE" && question.options && (
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setAnswer(question.id, option)}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                          answers[question.id] === option
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {question.type === "CHECKBOX" && question.options && (() => {
                  const selected: string[] = (() => {
                    try { return JSON.parse(answers[question.id] || "[]"); }
                    catch { return []; }
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
                                ? selected.filter((s) => s !== option)
                                : [...selected, option];
                              setAnswer(question.id, JSON.stringify(next));
                            }}
                            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors flex items-center gap-3 ${
                              isChecked
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            }`}
                          >
                            <span className={`h-4 w-4 rounded border flex items-center justify-center text-xs ${
                              isChecked ? "bg-primary-foreground text-primary" : "border-current"
                            }`}>
                              {isChecked ? "\u2713" : ""}
                            </span>
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {currentValidity && !currentValidity.dismissed && (
                  <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                    <p className="font-medium">
                      {currentValidity.score < 20
                        ? "Hmm, this doesn\u2019t seem related to the question \u2014 mind taking another look?"
                        : "Just a heads up \u2014 your answer might not fully cover what\u2019s being asked."}
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                      {currentValidity.explanation}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => dismissWarning(question.id)}>
                        Keep my answer
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Navigation buttons — outside the question cards */}
        <div className="flex justify-between pt-2">
          <Button
            variant="ghost"
            onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
            disabled={currentPageIndex === 0}
          >
            Previous
          </Button>
          <Button
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
