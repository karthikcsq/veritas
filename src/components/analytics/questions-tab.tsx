"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsData } from "@/types";

const TYPE_STYLE: Record<string, string> = {
  SCALE: "bg-blue-100 text-blue-700 border-blue-200",
  LONG_TEXT: "bg-violet-100 text-violet-700 border-violet-200",
  SHORT_TEXT: "bg-emerald-100 text-emerald-700 border-emerald-200",
  MULTIPLE_CHOICE: "bg-amber-100 text-amber-700 border-amber-200",
  CHECKBOX: "bg-pink-100 text-pink-700 border-pink-200",
};

export function QuestionsTab({ data }: { data: AnalyticsData | null }) {
  if (!data) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Loading analytics...</p>;
  }

  return (
    <div className="space-y-4">
      {data.questions.map((q) => (
        <Card key={q.id} className="transition-shadow hover:shadow-sm">
          <CardContent className="pb-5 pt-5">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
                {q.order}
              </div>
              <div className="flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge className={`text-[10px] ${TYPE_STYLE[q.type] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                    {q.type.replace("_", " ")}
                  </Badge>
                  <span
                    className={`text-xs ${q.responseRate < 95 ? "text-amber-600" : "text-muted-foreground"}`}
                  >
                    {q.responseRate}% response rate
                  </span>
                  {q.avgQuality !== null && (
                    <span
                      className={`text-xs font-medium ${
                        q.avgQuality >= 0.7 ? "text-emerald-600" : q.avgQuality >= 0.45 ? "text-amber-600" : "text-rose-600"
                      }`}
                    >
                      Avg quality: {(q.avgQuality * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="font-medium">{q.prompt}</p>
                {q.options && Array.isArray(q.options) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(q.options as string[]).map((o) => (
                      <span key={o} className="rounded border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                        {o}
                      </span>
                    ))}
                  </div>
                )}
                {q.stat && (
                  <div className="mt-2 text-sm text-muted-foreground">{q.stat}</div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  {q.responseCount} responses
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
