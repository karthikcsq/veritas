"use client";

import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalyticsData } from "@/types";

const QUALITY_COLORS = { high: "#10b981", moderate: "#f59e0b", flagged: "#ef4444" };
const DIMENSION_META = [
  { key: "coherence" as const, label: "Coherence", color: "#6d28d9" },
  { key: "effort" as const, label: "Effort", color: "#2563eb" },
  { key: "consistency" as const, label: "Consistency", color: "#059669" },
  { key: "overall" as const, label: "Overall", color: "#db2777" },
];

function CircleGauge({ score, color, label }: { score: number; color: string; label: string }) {
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#f1f5f9" strokeWidth="6" />
          <circle
            cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold tabular-nums">{score}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function OverviewTab({ data }: { data: AnalyticsData | null }) {
  if (!data) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Loading analytics...</p>;
  }

  const total = data.qualityDistribution.high + data.qualityDistribution.moderate + data.qualityDistribution.flagged;
  const qualityDist = [
    { name: "High Quality", value: total > 0 ? Math.round((data.qualityDistribution.high / total) * 100) : 0, color: QUALITY_COLORS.high },
    { name: "Moderate", value: total > 0 ? Math.round((data.qualityDistribution.moderate / total) * 100) : 0, color: QUALITY_COLORS.moderate },
    { name: "Flagged", value: total > 0 ? Math.round((data.qualityDistribution.flagged / total) * 100) : 0, color: QUALITY_COLORS.flagged },
  ];

  const lowestDim = DIMENSION_META.reduce((min, d) =>
    data.dimensions[d.key] < data.dimensions[min.key] ? d : min
  );
  const highestDim = DIMENSION_META.reduce((max, d) =>
    data.dimensions[d.key] > data.dimensions[max.key] ? d : max
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-8">
        <Card className="border-0 shadow-sm ring-1 ring-slate-200">
          <CardHeader className="pb-2 pt-6 px-6">
            <CardTitle className="text-lg">Quality Distribution</CardTitle>
            <CardDescription>Across all scored responses ({total} enrollments)</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={qualityDist} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
                  {qualityDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-1">
              {qualityDist.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-semibold">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-0 shadow-sm ring-1 ring-slate-200">
          <CardHeader className="pb-2 pt-6 px-6">
            <CardTitle className="text-lg">Enrollment & Completion Trend</CardTitle>
            <CardDescription>Cumulative over study period</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="gEnrolled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6d28d9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6d28d9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFlagged" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="enrolled" name="Enrolled" stroke="#6d28d9" fill="url(#gEnrolled)" strokeWidth={2} />
                <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" fill="url(#gCompleted)" strokeWidth={2} />
                <Area type="monotone" dataKey="flagged" name="Flagged" stroke="#ef4444" fill="url(#gFlagged)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="pb-2 pt-6 px-6">
          <CardTitle className="text-lg">Average Quality Dimensions</CardTitle>
          <CardDescription>Mean scores (0–100) across all evaluated responses</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex items-center justify-around py-8">
            {DIMENSION_META.map((d) => (
              <CircleGauge key={d.key} score={data.dimensions[d.key]} color={d.color} label={d.label} />
            ))}
          </div>
          <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/60 px-5 py-4 text-sm text-muted-foreground">
            <strong className="text-violet-700">Interpretation:</strong>{" "}
            {highestDim.label} leads at {data.dimensions[highestDim.key]} — participants are largely strong in this dimension.{" "}
            {lowestDim.label} ({data.dimensions[lowestDim.key]}) is the lowest dimension, suggesting
            some participants may need improvement in this area.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
