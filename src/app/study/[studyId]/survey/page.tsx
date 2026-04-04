"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Mock questions — replace with real data from enrollment
const mockQuestions = [
  { id: "q1", order: 1, type: "SCALE", prompt: "On a scale of 1-10, how would you rate your average daily pain level?" },
  { id: "q2", order: 2, type: "LONG_TEXT", prompt: "Describe how your pain affects your daily activities." },
  { id: "q3", order: 3, type: "MULTIPLE_CHOICE", prompt: "Which pain management methods have you tried?", options: ["Physical therapy", "Medication", "Acupuncture", "Exercise", "None"] },
  { id: "q4", order: 4, type: "LONG_TEXT", prompt: "Describe your experience with prescription pain medication." },
];

export default function SurveyPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const question = mockQuestions[currentIndex];
  const isLast = currentIndex === mockQuestions.length - 1;
  const progress = ((currentIndex + 1) / mockQuestions.length) * 100;

  function setAnswer(value: string) {
    setAnswers({ ...answers, [question.id]: value });
  }

  function handleNext() {
    if (isLast) {
      // TODO: POST /api/enrollments/:enrollmentId/responses
      setSubmitted(true);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
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
            <span>Question {currentIndex + 1} of {mockQuestions.length}</span>
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

            {question.type === "MULTIPLE_CHOICE" && "options" in question && (
              <div className="space-y-2">
                {(question.options as string[]).map((option) => (
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

            <div className="flex justify-between pt-4">
              <Button
                variant="ghost"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                Previous
              </Button>
              <Button
                onClick={handleNext}
                disabled={!answers[question.id]}
              >
                {isLast ? "Submit" : "Next"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
