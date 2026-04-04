"use client";

import { useState, useCallback, useMemo } from "react";
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

// Mock questions — replace with real data from enrollment
const mockQuestions: SurveyQuestion[] = [
  { id: "q1", order: 1, type: "SCALE", prompt: "On a scale of 1-10, how would you rate your average daily pain level?", required: true, config: { scale: { min: 1, max: 10, minLabel: "No pain", maxLabel: "Worst pain" } } },
  { id: "q2", order: 2, type: "LONG_TEXT", prompt: "Describe how your pain affects your daily activities.", required: true, dependsOn: { questionId: "q1", condition: "gte", value: 4 } },
  { id: "q3", order: 3, type: "CHECKBOX", prompt: "Which pain management methods have you tried? (select all that apply)", required: true, options: ["Physical therapy", "Medication", "Acupuncture", "Exercise", "None"] },
  { id: "q4", order: 4, type: "LONG_TEXT", prompt: "Describe your experience with prescription pain medication.", required: true, dependsOn: { questionId: "q3", condition: "includes", value: "Medication" } },
];

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
  dismissed: boolean;
}

export default function SurveyPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validity, setValidity] = useState<Record<string, ValidityState>>({});

  const visibleQuestions = useMemo(() => {
    return mockQuestions.filter((q) => {
      if (!q.dependsOn) return true;
      return evaluateDependency(q.dependsOn, answers);
    });
  }, [answers]);

  const question = visibleQuestions[currentIndex];
  const isLast = currentIndex === visibleQuestions.length - 1;
  const progress = ((currentIndex + 1) / visibleQuestions.length) * 100;
  const currentValidity = question ? validity[question.id] : undefined;

  function setAnswer(value: string) {
    setAnswers({ ...answers, [question.id]: value });
    if (validity[question.id]) {
      setValidity((prev) => {
        const next = { ...prev };
        delete next[question.id];
        return next;
      });
    }
  }

  const validateAndProceed = useCallback(async () => {
    const answer = answers[question.id];
    if (!answer) return;

    const needsLlmCheck =
      question.type === "LONG_TEXT" || question.type === "SHORT_TEXT";

    if (!needsLlmCheck) {
      if (isLast) {
        setSubmitted(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
      return;
    }

    const existing = validity[question.id];
    if (existing?.dismissed) {
      if (isLast) {
        setSubmitted(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
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

      if (data.score < 50) {
        setValidity((prev) => ({
          ...prev,
          [question.id]: {
            score: data.score,
            explanation: data.explanation,
            dismissed: false,
          },
        }));
      } else {
        if (isLast) {
          setSubmitted(true);
        } else {
          setCurrentIndex((i) => i + 1);
        }
      }
    } catch {
      if (isLast) {
        setSubmitted(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    } finally {
      setValidating(false);
    }
  }, [answers, question, isLast, validity]);

  function dismissWarning() {
    setValidity((prev) => ({
      ...prev,
      [question.id]: { ...prev[question.id], dismissed: true },
    }));
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <div className="w-full max-w-lg space-y-4">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Question {currentIndex + 1} of {visibleQuestions.length}</span>
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
                onChange={(e) => setAnswer(e.target.value)}
              />
            )}

            {question.type === "SHORT_TEXT" && (
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                          setAnswer(JSON.stringify(next));
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
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  currentValidity.score < 30
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-yellow-300 bg-yellow-50 text-yellow-800"
                }`}
              >
                <p className="font-medium">
                  {currentValidity.score < 30
                    ? "Your answer doesn\u2019t seem to address this question."
                    : "Your answer may not fully address this question."}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  {currentValidity.explanation}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={dismissWarning}
                  >
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
                disabled={!answers[question.id] || validating}
              >
                {validating
                  ? "Checking..."
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
