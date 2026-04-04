"use client";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const QUESTIONS = [
  "Q1: Pain Level",
  "Q2: Daily Impact",
  "Q3: Treatments",
  "Q4: Medication Exp.",
  "Q5: Biggest Challenge",
];

// Pairwise cosine similarity between avg responses per question
const SIMILARITY_MATRIX = [
  [1.0, 0.43, 0.28, 0.51, 0.37],
  [0.43, 1.0, 0.61, 0.44, 0.72],
  [0.28, 0.61, 1.0, 0.38, 0.55],
  [0.51, 0.44, 0.38, 1.0, 0.49],
  [0.37, 0.72, 0.55, 0.49, 1.0],
];

const TIME_DATA = [
  { q: "Q1", avg: 12, label: "12s" },
  { q: "Q2", avg: 145, label: "145s" },
  { q: "Q3", avg: 22, label: "22s" },
  { q: "Q4", avg: 98, label: "98s" },
  { q: "Q5", avg: 67, label: "67s" },
];

const LENGTH_VS_QUALITY = [
  { words: 12, quality: 0.32 },
  { words: 48, quality: 0.41 },
  { words: 156, quality: 0.91 },
  { words: 203, quality: 0.88 },
  { words: 87, quality: 0.72 },
  { words: 334, quality: 0.93 },
  { words: 244, quality: 0.84 },
  { words: 67, quality: 0.77 },
  { words: 189, quality: 0.79 },
  { words: 278, quality: 0.86 },
  { words: 15, quality: 0.28 },
  { words: 134, quality: 0.78 },
];

const CONSISTENCY_DATA = [
  { id: "e-4f2a", score: 0.94, flag: null },
  { id: "e-7b1c", score: 0.87, flag: null },
  {
    id: "e-2d9e",
    score: 0.31,
    flag: "Q2 contradicts Q4: claims minimal impact but later describes inability to work or leave the house",
  },
  { id: "e-8c3f", score: 0.92, flag: null },
  {
    id: "e-1a5b",
    score: 0.28,
    flag: "Q1 (pain: 3/10) inconsistent with Q2 which describes severe daily disability preventing basic tasks",
  },
  { id: "e-6e7d", score: 0.96, flag: null },
  { id: "e-3f8a", score: 0.78, flag: null },
  {
    id: "e-9g2h",
    score: 0.44,
    flag: "Q3 states never used medication; Q4 describes a detailed years-long opioid prescription history",
  },
  { id: "e-5h4i", score: 0.89, flag: null },
  { id: "e-0i6j", score: 0.83, flag: null },
];

function simColor(v: number): string {
  // Red (low) → yellow → green (high)
  const r = Math.round(239 * (1 - v) + 16 * v);
  const g = Math.round(68 * (1 - v * 1.2) + 185 * v);
  const b = Math.round(68 * (1 - v));
  return `rgb(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))})`;
}

export function LinguisticTab() {
  return (
    <div className="space-y-6">
      {/* Similarity matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Answer Similarity Matrix</CardTitle>
          <CardDescription>
            Pairwise semantic similarity between responses across questions
            (embedding cosine similarity). Scores below{" "}
            <span className="font-semibold text-rose-600">0.35</span> between
            non-identical questions may indicate contradictions or topic drift.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Column headers */}
              <div className="mb-1 flex items-end gap-1 pl-36">
                {QUESTIONS.map((q, i) => (
                  <div
                    key={i}
                    className="w-[72px] truncate px-1 text-center text-[11px] text-muted-foreground"
                    title={q}
                  >
                    {q}
                  </div>
                ))}
              </div>
              {/* Matrix rows */}
              {SIMILARITY_MATRIX.map((row, i) => (
                <div key={i} className="mb-1 flex items-center gap-1">
                  <div
                    className="w-36 truncate pr-2 text-right text-[11px] text-muted-foreground"
                    title={QUESTIONS[i]}
                  >
                    {QUESTIONS[i]}
                  </div>
                  {row.map((val, j) => (
                    <div
                      key={j}
                      className="flex h-12 w-[72px] items-center justify-center rounded text-xs font-bold text-white shadow-sm transition-transform hover:scale-105"
                      style={{ backgroundColor: simColor(val) }}
                      title={`${QUESTIONS[i]} × ${QUESTIONS[j]}: ${val.toFixed(2)}`}
                    >
                      {val.toFixed(2)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div
              className="h-3 w-24 rounded"
              style={{
                background:
                  "linear-gradient(to right, rgb(239,68,68), rgb(250,204,21), rgb(16,185,129))",
              }}
            />
            <span>Low → High similarity</span>
            <span className="ml-2 rounded bg-rose-50 px-2 py-0.5 text-rose-600">
              Q1 × Q3 = 0.28 — low overlap expected (scale vs. treatments)
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Time spent per question */}
        <Card>
          <CardHeader>
            <CardTitle>Avg Time per Question</CardTitle>
            <CardDescription>
              Seconds — bot responses typically fall under 15s for all questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={TIME_DATA} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="s" />
                <YAxis
                  dataKey="q"
                  type="category"
                  tick={{ fontSize: 12 }}
                  width={24}
                />
                <Tooltip formatter={(v) => [`${v}s`, "Avg Time"]} />
                <Bar dataKey="avg" name="Avg Time (s)" radius={[0, 4, 4, 0]}>
                  {TIME_DATA.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.avg < 20
                          ? "#ef4444"
                          : entry.avg < 50
                          ? "#f59e0b"
                          : "#6d28d9"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex gap-4 text-xs">
              <span className="flex items-center gap-1 text-rose-600">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> &lt;20s — suspicious
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> 20–50s — borderline
              </span>
              <span className="flex items-center gap-1 text-violet-600">
                <span className="h-2 w-2 rounded-full bg-violet-600" /> &gt;50s — expected
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Response length vs quality */}
        <Card>
          <CardHeader>
            <CardTitle>Response Length vs. Quality</CardTitle>
            <CardDescription>
              Avg word count per enrollment vs. overall quality score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
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
                  formatter={(v, name) => [
                    name === "quality"
                      ? (v as number).toFixed(2)
                      : `${v} words`,
                    name === "quality" ? "Quality Score" : "Avg Words",
                  ]}
                />
                <Scatter
                  data={LENGTH_VS_QUALITY}
                  fill="#6d28d9"
                  fillOpacity={0.7}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Consistency scores */}
      <Card>
        <CardHeader>
          <CardTitle>Semantic Consistency Scores</CardTitle>
          <CardDescription>
            Cross-response contradiction detection — lower scores indicate
            self-contradiction across answers within the same enrollment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {CONSISTENCY_DATA.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 border-b py-2.5 last:border-0"
              >
                <div className="w-16 font-mono text-xs text-muted-foreground">
                  {p.id}
                </div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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
                      ? "text-emerald-600"
                      : p.score >= 0.5
                      ? "text-amber-600"
                      : "text-rose-600"
                  }`}
                >
                  {p.score.toFixed(2)}
                </div>
                {p.flag && (
                  <div
                    className="max-w-xs truncate text-xs text-rose-600"
                    title={p.flag}
                  >
                    ⚠ {p.flag}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
