"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const QUESTIONS = [
  {
    order: 1,
    type: "SCALE",
    prompt: "On a scale of 1-10, how would you rate your average daily pain level?",
    stat: "Avg response: 6.8 / 10",
    responseRate: 100,
  },
  {
    order: 2,
    type: "LONG_TEXT",
    prompt: "Describe how your pain affects your daily activities.",
    stat: "Avg length: 87 words",
    responseRate: 100,
  },
  {
    order: 3,
    type: "MULTIPLE_CHOICE",
    prompt: "Which pain management methods have you tried?",
    options: ["Physical therapy", "Medication", "Acupuncture", "Exercise", "None"],
    stat: "Top choice: Physical therapy (74%)",
    responseRate: 100,
  },
  {
    order: 4,
    type: "LONG_TEXT",
    prompt: "Describe your experience with prescription pain medication.",
    stat: "Avg length: 124 words",
    responseRate: 91,
  },
  {
    order: 5,
    type: "SHORT_TEXT",
    prompt: "What is your single biggest challenge in managing pain day-to-day?",
    stat: "Avg length: 34 words",
    responseRate: 95,
  },
];

const TYPE_STYLE: Record<string, string> = {
  SCALE: "bg-blue-100 text-blue-700 border-blue-200",
  LONG_TEXT: "bg-violet-100 text-violet-700 border-violet-200",
  SHORT_TEXT: "bg-emerald-100 text-emerald-700 border-emerald-200",
  MULTIPLE_CHOICE: "bg-amber-100 text-amber-700 border-amber-200",
};

interface QuestionsTabProps {
  questionStats: any[];
}

export function QuestionsTab({ questionStats }: QuestionsTabProps) {
  return (
    <div className="space-y-4">
      {QUESTIONS.map((q) => (
        <Card key={q.order} className="transition-shadow hover:shadow-sm">
          <CardContent className="pb-5 pt-5">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
                {q.order}
              </div>
              <div className="flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge className={`text-[10px] ${TYPE_STYLE[q.type]}`}>
                    {q.type.replace("_", " ")}
                  </Badge>
                  <span
                    className={`text-xs ${
                      q.responseRate < 95
                        ? "text-amber-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {q.responseRate}% response rate
                  </span>
                </div>
                <p className="font-medium">{q.prompt}</p>
                {q.options && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.options.map((o) => (
                      <span
                        key={o}
                        className="rounded border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-sm text-muted-foreground">
                  {q.stat}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
