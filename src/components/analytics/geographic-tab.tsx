"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const COUNTRY_DATA = [
  {
    country: "United States",
    code: "US",
    flag: "🇺🇸",
    count: 5,
    pct: 41.7,
    avgQuality: 0.64,
    flagged: 2,
  },
  {
    country: "India",
    code: "IN",
    flag: "🇮🇳",
    count: 2,
    pct: 16.7,
    avgQuality: 0.59,
    flagged: 1,
  },
  {
    country: "United Kingdom",
    code: "GB",
    flag: "🇬🇧",
    count: 1,
    pct: 8.3,
    avgQuality: 0.84,
    flagged: 0,
  },
  {
    country: "Japan",
    code: "JP",
    flag: "🇯🇵",
    count: 1,
    pct: 8.3,
    avgQuality: 0.93,
    flagged: 0,
  },
  {
    country: "Germany",
    code: "DE",
    flag: "🇩🇪",
    count: 1,
    pct: 8.3,
    avgQuality: 0.88,
    flagged: 0,
  },
  {
    country: "Canada",
    code: "CA",
    flag: "🇨🇦",
    count: 1,
    pct: 8.3,
    avgQuality: 0.72,
    flagged: 0,
  },
  {
    country: "Australia",
    code: "AU",
    flag: "🇦🇺",
    count: 1,
    pct: 8.3,
    avgQuality: 0.79,
    flagged: 0,
  },
  {
    country: "Brazil",
    code: "BR",
    flag: "🇧🇷",
    count: 1,
    pct: 8.3,
    avgQuality: 0.77,
    flagged: 0,
  },
  {
    country: "France",
    code: "FR",
    flag: "🇫🇷",
    count: 1,
    pct: 8.3,
    avgQuality: null,
    flagged: 0,
  },
];

const BAR_COLORS = [
  "#6d28d9",
  "#7c3aed",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#5b21b6",
  "#4c1d95",
  "#3b0764",
  "#9333ea",
];

function qualityColor(q: number | null) {
  if (q === null) return "text-muted-foreground";
  if (q >= 0.7) return "text-emerald-600";
  if (q >= 0.5) return "text-amber-600";
  return "text-rose-600";
}

function qualityBar(q: number | null) {
  if (q === null) return "bg-slate-200";
  if (q >= 0.7) return "bg-emerald-500";
  if (q >= 0.5) return "bg-amber-400";
  return "bg-rose-500";
}

export function GeographicTab() {
  const sorted = [...COUNTRY_DATA].sort((a, b) => b.count - a.count);
  const byQuality = [...COUNTRY_DATA]
    .filter((c) => c.avgQuality !== null)
    .sort((a, b) => (b.avgQuality ?? 0) - (a.avgQuality ?? 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        {/* Horizontal bar chart */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Responses by Country</CardTitle>
            <CardDescription>
              Participant origin distribution — detected via World ID credential
              region
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={sorted} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  dataKey="flag"
                  type="category"
                  tick={{ fontSize: 18 }}
                  width={36}
                />
                <Tooltip
                  formatter={(v) => [`${v} participants`, "Count"]}
                  labelFormatter={(_, payload) => {
                    const d = payload?.[0]?.payload;
                    return d ? `${d.flag} ${d.country}` : "";
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Participants"
                  radius={[0, 6, 6, 0]}
                >
                  {sorted.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quality by country */}
        <Card>
          <CardHeader>
            <CardTitle>Avg Quality by Country</CardTitle>
            <CardDescription>Ranked high → low</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            {byQuality.map((c) => (
              <div key={c.code} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <span>{c.flag}</span>
                    <span className="text-muted-foreground">{c.country}</span>
                  </span>
                  <span className={`font-semibold ${qualityColor(c.avgQuality)}`}>
                    {c.avgQuality?.toFixed(2)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${qualityBar(c.avgQuality)}`}
                    style={{ width: `${(c.avgQuality ?? 0) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Country cards grid */}
      <div className="grid grid-cols-4 gap-4 xl:grid-cols-5">
        {sorted.map((c) => (
          <Card
            key={c.code}
            className="transition-shadow hover:shadow-md"
          >
            <CardContent className="pb-5 pt-5">
              <div className="mb-2 text-4xl">{c.flag}</div>
              <div className="text-sm font-semibold">{c.country}</div>
              <div className="mt-1 text-2xl font-bold">{c.count}</div>
              <div className="text-xs text-muted-foreground">
                {c.pct}% of total
              </div>
              {c.flagged > 0 && (
                <div className="mt-1 text-xs text-rose-600">
                  {c.flagged} flagged
                </div>
              )}
              <div className="mt-3 text-xs">
                <span className="text-muted-foreground">Avg Quality: </span>
                {c.avgQuality !== null ? (
                  <span className={`font-semibold ${qualityColor(c.avgQuality)}`}>
                    {c.avgQuality.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insight callout */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="py-4">
          <div className="flex items-start gap-3 text-sm">
            <span className="text-xl">💡</span>
            <div>
              <strong>Geographic Insight:</strong> The United States accounts for
              41.7% of responses but also has the highest flag rate (2 of 5
              submissions flagged). Japan and Germany have the highest average
              quality scores (0.93 and 0.88 respectively) with zero flagged
              submissions. Consider adjusting recruitment targeting.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
