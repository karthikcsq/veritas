"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from "recharts";
import { ChevronDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function simColor(v: number): string {
  const r = Math.round(239 * (1 - v) + 16 * v);
  const g = Math.round(68 * (1 - v * 1.2) + 185 * v);
  const b = Math.round(68 * (1 - v));
  return `rgb(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))})`;
}

interface Enrollment {
  id: string;
  status: string;
  overallScore: number | null;
  coherenceScore: number | null;
  effortScore: number | null;
  consistencyScore: number | null;
  similarityScore: number | null;
  flagged: boolean;
  flagReason: string | null;
  similarityReason: string | null;
  responses: {
    questionId: string;
    questionPrompt: string;
    questionType: string;
    value: string;
    timeSpentMs: number | null;
    wordCount: number;
  }[];
}

interface QuestionStat {
  questionId: string;
  order: number;
  type: string;
  prompt: string;
  options: string[] | null;
  responseCount: number;
  totalEnrollments: number;
  avgTimeSec: number | null;
  avgQuality: number | null;
  avgSimilarity: number | null;
}

interface LinguisticTabProps {
  enrollments: Enrollment[];
  questionStats: QuestionStat[];
}

const DIMENSIONS = ["coherence", "effort", "consistency", "similarity"] as const;
const DIM_LABELS: Record<string, string> = {
  coherence: "Coherence",
  effort: "Effort",
  consistency: "Consistency",
  similarity: "Similarity",
};

const PREVIEW_COUNT = 5;

export function LinguisticTab({ enrollments, questionStats }: LinguisticTabProps) {
  const [heatmapExpanded, setHeatmapExpanded] = useState(false);
  const [consistencyExpanded, setConsistencyExpanded] = useState(false);

  const scoredEnrollments = useMemo(
    () => enrollments.filter((e) => e.overallScore !== null),
    [enrollments]
  );

  const heatmapData = useMemo(() => {
    return scoredEnrollments.slice(0, 30).map((e) => ({
      id: e.id.slice(0, 8),
      fullId: e.id,
      coherence: e.coherenceScore ?? 0,
      effort: e.effortScore ?? 0,
      consistency: e.consistencyScore ?? 0,
      similarity: e.similarityScore ?? null,
    }));
  }, [scoredEnrollments]);

  const timeData = useMemo(() => {
    return questionStats
      .filter((q) => q.avgTimeSec !== null)
      .map((q) => ({
        q: `Q${q.order}`,
        avg: q.avgTimeSec!,
        prompt: q.prompt,
        label: `${q.avgTimeSec}s`,
      }));
  }, [questionStats]);

  const lengthVsQuality = useMemo(() => {
    return scoredEnrollments
      .filter((e) => e.responses.length > 0)
      .map((e) => {
        const totalWords = e.responses.reduce((sum, r) => sum + r.wordCount, 0);
        const avgWords = Math.round(totalWords / e.responses.length);
        return { words: avgWords, quality: e.overallScore ?? 0 };
      });
  }, [scoredEnrollments]);

  const consistencyData = useMemo(() => {
    return scoredEnrollments.map((e) => ({
      id: e.id.slice(0, 8),
      score: e.consistencyScore ?? 0,
      flag: e.flagged ? e.flagReason : null,
    }));
  }, [scoredEnrollments]);

  if (enrollments.length === 0) {
    return (
      <Card className="border-0 shadow-sm ring-1 ring-white/10">
        <CardContent className="flex items-center justify-center py-20 text-muted-foreground">
          No enrollment data yet. Linguistic analysis will appear once participants complete the survey.
        </CardContent>
      </Card>
    );
  }

  const visibleHeatmap = heatmapExpanded ? heatmapData : heatmapData.slice(0, PREVIEW_COUNT);
  const heatmapHasMore = heatmapData.length > PREVIEW_COUNT;

  const visibleConsistency = consistencyExpanded ? consistencyData : consistencyData.slice(0, PREVIEW_COUNT);
  const consistencyHasMore = consistencyData.length > PREVIEW_COUNT;

  return (
    <div className="space-y-8">
      {/* Charts row — always visible, compact */}
      <div className="grid grid-cols-2 gap-8">
        <Card className="border-0 shadow-sm ring-1 ring-white/10">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-lg">Avg Time per Question</CardTitle>
            <CardDescription>
              Seconds — bot responses typically fall under 15s for all questions
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {timeData.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No response time data yet.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={timeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="s" />
                    <YAxis
                      dataKey="q"
                      type="category"
                      tick={{ fontSize: 12 }}
                      width={30}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v}s`, "Avg Time"]}
                      labelFormatter={(label: string) => {
                        const stat = timeData.find((d) => d.q === label);
                        return stat?.prompt ?? label;
                      }}
                    />
                    <Bar dataKey="avg" name="Avg Time (s)" radius={[0, 4, 4, 0]}>
                      {timeData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.avg < 20
                              ? "#ef4444"
                              : entry.avg < 50
                              ? "#f59e0b"
                              : "#2874a6"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 flex gap-4 text-xs">
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> &lt;20s — suspicious
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-400" /> 20–50s — borderline
                  </span>
                  <span className="flex items-center gap-1 text-[#3498db]">
                    <span className="h-2 w-2 rounded-full bg-[#2874a6]" /> &gt;50s — expected
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-white/10">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-lg">Response Length vs. Quality</CardTitle>
            <CardDescription>
              Avg word count per enrollment vs. overall quality score
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {lengthVsQuality.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No response data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart
                  margin={{ top: 10, right: 20, bottom: 20, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="words"
                    name="Avg Words"
                    tick={{ fontSize: 11 }}
                    label={{
                      value: "Avg Words",
                      position: "insideBottom",
                      offset: -10,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    dataKey="quality"
                    name="Quality"
                    domain={[0, 1]}
                    tick={{ fontSize: 11 }}
                    label={{
                      value: "Quality",
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 11,
                    }}
                  />
                  <ZAxis range={[50, 50]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    formatter={(v: number, name: string) => [
                      name === "quality"
                        ? v.toFixed(2)
                        : `${v} words`,
                      name === "quality" ? "Quality Score" : "Avg Words",
                    ]}
                  />
                  <Scatter
                    data={lengthVsQuality}
                    fill="#6d28d9"
                    fillOpacity={0.7}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quality dimension heatmap — collapsible */}
      <Card className="border-0 shadow-sm ring-1 ring-white/10">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="text-lg">Quality Dimension Heatmap</CardTitle>
          <CardDescription>
            Per-enrollment scores across quality dimensions. Scores below{" "}
            <span className="font-semibold text-rose-400">0.40</span> indicate
            potential quality issues in that dimension.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {heatmapData.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No scored enrollments yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  <div className="mb-1 flex items-end gap-1 pl-24">
                    {DIMENSIONS.map((dim) => (
                      <div
                        key={dim}
                        className="w-[90px] truncate px-1 text-center text-[11px] font-medium text-muted-foreground"
                      >
                        {DIM_LABELS[dim]}
                      </div>
                    ))}
                  </div>
                  {visibleHeatmap.map((row) => (
                    <div key={row.fullId} className="mb-1 flex items-center gap-1">
                      <div
                        className="w-24 truncate pr-2 text-right font-mono text-[11px] text-muted-foreground"
                        title={row.fullId}
                      >
                        {row.id}
                      </div>
                      {DIMENSIONS.map((dim) => {
                        const val = row[dim];
                        if (val === null) {
                          return (
                            <div
                              key={dim}
                              className="flex h-10 w-[90px] items-center justify-center rounded bg-white/10 text-[10px] text-muted-foreground"
                            >
                              n/a
                            </div>
                          );
                        }
                        return (
                          <div
                            key={dim}
                            className="flex h-10 w-[90px] items-center justify-center rounded text-xs font-bold text-white shadow-sm transition-transform hover:scale-105"
                            style={{ backgroundColor: simColor(val) }}
                            title={`${row.id} — ${DIM_LABELS[dim]}: ${val.toFixed(2)}`}
                          >
                            {val.toFixed(2)}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div
                    className="h-3 w-24 rounded"
                    style={{
                      background:
                        "linear-gradient(to right, rgb(239,68,68), rgb(250,204,21), rgb(16,185,129))",
                    }}
                  />
                  <span>Low → High score</span>
                </div>
                {heatmapHasMore && (
                  <button
                    onClick={() => setHeatmapExpanded((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    {heatmapExpanded
                      ? "Show less"
                      : `Show all ${heatmapData.length} enrollments`}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${heatmapExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Consistency scores — collapsible */}
      <Card className="border-0 shadow-sm ring-1 ring-white/10">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="text-lg">Semantic Consistency Scores</CardTitle>
          <CardDescription>
            Cross-response contradiction detection — lower scores indicate
            self-contradiction across answers within the same enrollment
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {consistencyData.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No consistency data yet.
            </div>
          ) : (
            <>
              <div className="space-y-0">
                {visibleConsistency.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 border-b py-3.5 last:border-0"
                  >
                    <div className="w-16 font-mono text-xs text-muted-foreground">
                      {p.id}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all ${
                            p.score >= 0.7
                              ? "bg-emerald-500"
                              : p.score >= 0.5
                              ? "bg-amber-400"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${p.score * 100}%` }}
                        />
                      </div>
                    </div>
                    <div
                      className={`w-10 text-right text-sm font-bold tabular-nums ${
                        p.score >= 0.7
                          ? "text-emerald-400"
                          : p.score >= 0.5
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {p.score.toFixed(2)}
                    </div>
                    {p.flag && (
                      <div
                        className="max-w-xs truncate text-xs text-rose-400"
                        title={p.flag}
                      >
                        ⚠ {p.flag}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {consistencyHasMore && (
                <button
                  onClick={() => setConsistencyExpanded((v) => !v)}
                  className="mt-3 flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {consistencyExpanded
                    ? "Show less"
                    : `Show all ${consistencyData.length} enrollments`}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${consistencyExpanded ? "rotate-180" : ""}`}
                  />
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
