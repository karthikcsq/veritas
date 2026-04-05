"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Human heatmap: spread-out organic movement with natural hot spots
function buildHumanGrid(): number[][] {
  const R = 16, C = 22;
  const grid: number[][] = Array.from({ length: R }, () => Array(C).fill(0));

  const hotSpots = [
    { r: 1, c: 3, radius: 2.5, intensity: 0.65 },  // top nav
    { r: 1, c: 18, radius: 1.5, intensity: 0.5 },  // top-right nav
    { r: 3, c: 10, radius: 3, intensity: 0.85 },   // question title (reading)
    { r: 5, c: 9, radius: 3.5, intensity: 1.0 },   // text input focus
    { r: 7, c: 7, radius: 2, intensity: 0.6 },     // option selection
    { r: 9, c: 17, radius: 2.5, intensity: 0.9 },  // Next button
    { r: 11, c: 10, radius: 3, intensity: 0.75 },  // second question
    { r: 13, c: 9, radius: 2.5, intensity: 0.7 },  // answer area 2
    { r: 14, c: 18, radius: 2, intensity: 0.95 },  // Submit button
    { r: 4, c: 2, radius: 1.5, intensity: 0.3 },   // random wander
    { r: 8, c: 14, radius: 1.5, intensity: 0.35 }, // distraction hover
    { r: 6, c: 18, radius: 1, intensity: 0.25 },   // scroll area
  ];

  for (const s of hotSpots) {
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const dist = Math.sqrt((r - s.r) ** 2 + (c - s.c) ** 2);
        const contrib = Math.max(0, s.intensity * (1 - dist / (s.radius * 1.8)));
        grid[r][c] = Math.min(1, grid[r][c] + contrib);
      }
    }
  }

  // Add organic noise
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      grid[r][c] = Math.min(1, grid[r][c] + (Math.sin(r * 1.3 + c) * 0.04 + 0.04));
    }
  }

  return grid;
}

// Bot heatmap: linear vertical path, concentrated column, precise button clicks
function buildBotGrid(): number[][] {
  const R = 16, C = 22;
  const grid: number[][] = Array.from({ length: R }, () => Array(C).fill(0));

  // Single narrow vertical column — bot follows the center form element
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const colDist = Math.abs(c - 11);
      if (colDist === 0) grid[r][c] = 0.85;
      else if (colDist === 1) grid[r][c] = 0.4;
      else if (colDist === 2) grid[r][c] = 0.1;
    }
  }

  // Precise click on submit — only that exact region
  for (let r = 13; r < 16; r++) {
    for (let c = 18; c < 22; c++) {
      grid[r][c] = 1.0;
    }
  }

  return grid;
}

const HUMAN_GRID = buildHumanGrid();
const BOT_GRID = buildBotGrid();

function humanCellColor(v: number): string {
  if (v < 0.05) return "transparent";
  if (v < 0.25) return `rgba(59,130,246,${(v * 3).toFixed(2)})`;
  if (v < 0.5) return `rgba(234,179,8,${(v * 1.6).toFixed(2)})`;
  if (v < 0.75) return `rgba(249,115,22,${v.toFixed(2)})`;
  return `rgba(239,68,68,${v.toFixed(2)})`;
}

function botCellColor(v: number): string {
  if (v < 0.05) return "transparent";
  return `rgba(16,185,129,${(v * 0.95).toFixed(2)})`;
}

const ENTROPY_DATA = [
  { id: "e-4f2a", entropy: 0.81, pattern: "Human" },
  { id: "e-7b1c", entropy: 0.74, pattern: "Human" },
  { id: "e-2d9e", entropy: 0.12, pattern: "Bot" },
  { id: "e-8c3f", entropy: 0.88, pattern: "Human" },
  { id: "e-1a5b", entropy: 0.09, pattern: "Bot" },
  { id: "e-6e7d", entropy: 0.79, pattern: "Human" },
  { id: "e-3f8a", entropy: 0.65, pattern: "Human" },
  { id: "e-9g2h", entropy: 0.11, pattern: "Bot" },
  { id: "e-5h4i", entropy: 0.83, pattern: "Human" },
  { id: "e-0i6j", entropy: 0.72, pattern: "Human" },
  { id: "e-2k0l", entropy: 0.68, pattern: "Human" },
];

function Heatmap({
  grid,
  colorFn,
}: {
  grid: number[][];
  colorFn: (v: number) => string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white/5">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 bg-white/10 px-3 py-2">
        <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <div className="mx-2 flex flex-1 items-center rounded bg-slate-700 px-2 py-0.5">
          <span className="text-[9px] text-white/40">
            survey.veritas.io/study/pms-2024/survey
          </span>
        </div>
      </div>
      <div className="p-1">
        {grid.map((row, r) => (
          <div key={r} className="flex">
            {row.map((v, c) => (
              <div
                key={c}
                className="flex-1"
                style={{
                  height: "18px",
                  backgroundColor: colorFn(v),
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BehaviorTab() {
  const humanCount = ENTROPY_DATA.filter((p) => p.pattern === "Human").length;
  const botCount = ENTROPY_DATA.filter((p) => p.pattern === "Bot").length;

  return (
    <div className="space-y-8">
      {/* Info banner */}
      <Card className="border-0 bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl">
              🖱️
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                Mouse Movement Entropy Analysis
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                We record cursor trajectories during survey completion. Human
                respondents exhibit high-entropy, organic paths with natural
                pauses, regressions, and exploration. Bots follow low-entropy
                linear tracks with near-zero variance in timing and position.
              </p>
              <div className="mt-3 flex gap-6 text-sm">
                <span className="flex items-center gap-1.5 text-blue-300">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  {humanCount} human patterns detected
                </span>
                <span className="flex items-center gap-1.5 text-rose-300">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  {botCount} bot-like patterns flagged
                </span>
                <span className="flex items-center gap-1.5 text-white/40">
                  Threshold: entropy &lt; 0.40 → automated
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-side heatmaps */}
      <div className="grid grid-cols-2 gap-8">
        <Card className="border-0 shadow-sm ring-1 ring-white/10">
          <CardHeader className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Human Movement Pattern</CardTitle>
                <CardDescription>
                  High entropy · Organic path · Natural exploration
                </CardDescription>
              </div>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                Entropy: 0.81
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Heatmap grid={HUMAN_GRID} colorFn={humanCellColor} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white/5 p-2">
                <div className="font-bold text-white/70">1,847</div>
                <div className="text-muted-foreground">Cursor Events</div>
              </div>
              <div className="rounded-lg bg-blue-50 p-2">
                <div className="font-bold text-blue-600">0.81</div>
                <div className="text-muted-foreground">Path Entropy</div>
              </div>
              <div className="rounded-lg bg-white/5 p-2">
                <div className="font-bold text-white/70">312s</div>
                <div className="text-muted-foreground">Time on Page</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-rose-500/30">
          <CardHeader className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-rose-400">
                  Bot / Automated Pattern
                </CardTitle>
                <CardDescription>
                  Low entropy · Linear path · No exploration
                </CardDescription>
              </div>
              <Badge variant="destructive">Entropy: 0.11</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Heatmap grid={BOT_GRID} colorFn={botCellColor} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-rose-50 p-2">
                <div className="font-bold text-rose-400">47</div>
                <div className="text-muted-foreground">Cursor Events</div>
              </div>
              <div className="rounded-lg bg-rose-50 p-2">
                <div className="font-bold text-rose-400">0.11</div>
                <div className="text-muted-foreground">Path Entropy</div>
              </div>
              <div className="rounded-lg bg-rose-50 p-2">
                <div className="font-bold text-rose-400">12s</div>
                <div className="text-muted-foreground">Time on Page</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-participant entropy */}
      <Card className="border-0 shadow-sm ring-1 ring-white/10">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="text-lg">Per-Participant Movement Entropy</CardTitle>
          <CardDescription>
            Scores below{" "}
            <span className="font-semibold text-rose-400">0.40</span> indicate
            automated or bot-assisted behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="space-y-0">
            {ENTROPY_DATA.map((p) => (
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
                        p.entropy >= 0.4 ? "bg-blue-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${p.entropy * 100}%` }}
                    />
                  </div>
                </div>
                <div
                  className={`w-10 text-right text-sm font-bold tabular-nums ${
                    p.entropy >= 0.4 ? "text-blue-600" : "text-rose-400"
                  }`}
                >
                  {p.entropy.toFixed(2)}
                </div>
                <Badge
                  className={
                    p.pattern === "Bot"
                      ? "bg-rose-100 text-rose-400 border-rose-200"
                      : "bg-blue-100 text-blue-700 border-blue-200"
                  }
                >
                  {p.pattern}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Heatmap legend */}
      <Card className="border-0 bg-white/5 ring-1 ring-white/10">
        <CardContent className="py-5 px-6">
          <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-20 rounded"
                style={{
                  background:
                    "linear-gradient(to right, rgba(59,130,246,0.3), rgba(234,179,8,0.8), rgba(239,68,68,1))",
                }}
              />
              <span>Human: low → high cursor density</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-20 rounded"
                style={{
                  background:
                    "linear-gradient(to right, transparent, rgba(16,185,129,0.9))",
                }}
              />
              <span>Bot: automated path intensity</span>
            </div>
            <span>
              Each cell ≈ 50×50px screen region · Survey viewport 1024×768
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
