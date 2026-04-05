"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Question {
  id: string;
  order: number;
  type: string;
  prompt: string;
  options?: string[] | null;
}

const TYPE_STYLE: Record<string, string> = {
  SCALE: "bg-[#2874a6]/20 text-[#5dade2] border-[#2874a6]/30",
  LONG_TEXT: "bg-[#1a5276]/20 text-[#85c1e9] border-[#1a5276]/30",
  SHORT_TEXT: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  MULTIPLE_CHOICE: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  CHECKBOX: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

// Fallback mock data for when no questions prop is provided
const MOCK_QUESTIONS: Question[] = [
  {
    id: "q1",
    order: 1,
    type: "SCALE",
    prompt: "On a scale of 1-10, how would you rate your average daily pain level?",
  },
  {
    id: "q2",
    order: 2,
    type: "LONG_TEXT",
    prompt: "Describe how your pain affects your daily activities.",
  },
  {
    id: "q3",
    order: 3,
    type: "MULTIPLE_CHOICE",
    prompt: "Which pain management methods have you tried?",
    options: ["Physical therapy", "Medication", "Acupuncture", "Exercise", "None"],
  },
  {
    id: "q4",
    order: 4,
    type: "LONG_TEXT",
    prompt: "Describe your experience with prescription pain medication.",
  },
  {
    id: "q5",
    order: 5,
    type: "SHORT_TEXT",
    prompt: "What is your single biggest challenge in managing pain day-to-day?",
  },
];

export function QuestionsTab({ questions }: { questions?: Question[] }) {
  const displayQuestions = questions && questions.length > 0 ? questions : MOCK_QUESTIONS;

  return (
    <div className="space-y-4">
      {displayQuestions.map((q) => (
        <Card key={q.id || q.order} className="transition-shadow hover:shadow-sm">
          <CardContent className="pb-5 pt-5">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2874a6] to-[#1a5276] text-sm font-bold text-white">
                {q.order}
              </div>
              <div className="flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge className={`text-[10px] ${TYPE_STYLE[q.type] ?? "bg-white/10 text-white/60"}`}>
                    {q.type.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="font-medium text-white">{q.prompt}</p>
                {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.options.map((o) => (
                      <span
                        key={o}
                        className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
