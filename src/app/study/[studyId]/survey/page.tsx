"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuestionType, ValidateResponseResponse } from "@/types";

interface Question {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  options?: string[];
}

interface ValidityState {
  score: number;
  explanation: string;
  dismissed: boolean;
}

export default function SurveyPage() {
  const { studyId } = useParams<{ studyId: string }>();
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get("enrollmentId");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
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
          const qs = (data.study.questions ?? []).map((q: Question) => ({
            ...q,
            options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
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

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const currentValidity = question ? validity[question.id] : undefined;

  function setAnswer(value: string) {
    if (!question) return;
    setAnswers({ ...answers, [question.id]: value });
    if (validity[question.id]) {
      setValidity((prev) => {
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
    }
  }

  function advanceToNext() {
    if (isLast) {
      submitResponses();
    } else {
      const nextQ = questions[currentIndex + 1];
      setTimeStarted((prev) => ({ ...prev, [nextQ.id]: Date.now() }));
      setCurrentIndex((i) => i + 1);
    }
  }

  async function submitResponses() {
    if (!enrollmentId) {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    try {
      const now = Date.now();
      const responsePayload = questions.map((q) => ({
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
    if (!question) return;
    const answer = answers[question.id];
    if (!answer) return;

    const needsLlmCheck =
      question.type === "LONG_TEXT" || question.type === "SHORT_TEXT";

    if (!needsLlmCheck) {
      advanceToNext();
      return;
    }

    const existing = validity[question.id];
    if (existing?.dismissed) {
      advanceToNext();
      return;
    }

    setValidating(true);
    try {
      const res = await fetch("/api/validate-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.prompt,
          answer,
          questionType: question.type,
        }),
      });
      const data: ValidateResponseResponse = await res.json();

      if (data.score < 40) {
        setValidity((prev) => ({
          ...prev,
          [question.id]: {
            score: data.score,
            explanation: data.explanation,
            dismissed: false,
          },
        }));
      } else {
        advanceToNext();
      }
    } catch {
      advanceToNext();
    } finally {
      setValidating(false);
    }
  }, [answers, question, isLast, validity, questions, currentIndex, timeStarted, enrollmentId]);

  function dismissWarning() {
    if (!question) return;
    setValidity((prev) => ({
      ...prev,
      [question.id]: { ...prev[question.id], dismissed: true },
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

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{question.prompt}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {question.type === "SCALE" && (
              <div className="flex gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswer(String(n))}
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
            )}

            {(question.type === "LONG_TEXT" || question.type === "SHORT_TEXT") && (
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Type your answer..."
                value={answers[question.id] || ""}
                onChange={(e) => setAnswer(e.target.value)}
              />
            )}

            {question.type === "MULTIPLE_CHOICE" && question.options && (
              <div className="space-y-2">
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAnswer(option)}
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

            {currentValidity && !currentValidity.dismissed && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                <p className="font-medium">
                  {currentValidity.score < 20
                    ? "Hmm, this doesn\u2019t seem related to the question — mind taking another look?"
                    : "Just a heads up — your answer might not fully cover what\u2019s being asked."}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  {currentValidity.explanation}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={dismissWarning}>
                    Keep my answer
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="ghost"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                Previous
              </Button>
              <Button
                onClick={validateAndProceed}
                disabled={!answers[question.id] || validating || submitting}
              >
                {validating
                  ? "Checking..."
                  : submitting
                    ? "Submitting..."
                    : isLast
                      ? "Submit"
                      : "Next"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
