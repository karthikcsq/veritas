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
  SCALE: "bg-blue-100 text-blue-700 border-blue-200",
  LONG_TEXT: "bg-violet-100 text-violet-700 border-violet-200",
  SHORT_TEXT: "bg-emerald-100 text-emerald-700 border-emerald-200",
  MULTIPLE_CHOICE: "bg-amber-100 text-amber-700 border-amber-200",
  CHECKBOX: "bg-orange-100 text-orange-700 border-orange-200",
};

export function QuestionsTab({ questions }: { questions?: Question[] }) {
  if (!questions || questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No questions added to this study yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <Card key={q.id} className="transition-shadow hover:shadow-sm">
          <CardContent className="pb-5 pt-5">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
                {q.order}
              </div>
              <div className="flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge className={`text-[10px] ${TYPE_STYLE[q.type] ?? "bg-gray-100 text-gray-700"}`}>
                    {q.type.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="font-medium">{q.prompt}</p>
                {q.options && Array.isArray(q.options) && q.options.length > 0 && (
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
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
