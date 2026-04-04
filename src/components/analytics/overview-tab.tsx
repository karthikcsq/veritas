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

const QUALITY_DIST = [
  { name: "High Quality", value: 58, color: "#10b981" },
  { name: "Moderate", value: 25, color: "#f59e0b" },
  { name: "Flagged", value: 17, color: "#ef4444" },
];

const ENROLLMENT_TREND = [
  { date: "Jan 10", enrolled: 2, completed: 1, flagged: 0 },
  { date: "Jan 11", enrolled: 5, completed: 3, flagged: 1 },
  { date: "Jan 12", enrolled: 8, completed: 6, flagged: 1 },
  { date: "Jan 13", enrolled: 11, completed: 8, flagged: 2 },
  { date: "Jan 14", enrolled: 13, completed: 10, flagged: 2 },
  { date: "Jan 15", enrolled: 16, completed: 13, flagged: 3 },
  { date: "Jan 16", enrolled: 18, completed: 15, flagged: 3 },
];

const DIMENSION_SCORES = [
  { label: "Coherence", score: 74, color: "#6d28d9" },
  { label: "Effort", score: 68, color: "#2563eb" },
  { label: "Consistency", score: 81, color: "#059669" },
  { label: "Specificity", score: 71, color: "#d97706" },
  { label: "Authenticity", score: 78, color: "#db2777" },
];

function CircleGauge({
  score,
  color,
  label,
}: {
  score: number;
  color: string;
  label: string;
}) {
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="6"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
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

export function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        {/* Donut chart */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Distribution</CardTitle>
            <CardDescription>Across all scored responses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={QUALITY_DIST}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {QUALITY_DIST.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-1">
              {QUALITY_DIST.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                  <span className="font-semibold">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Enrollment trend */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Enrollment & Completion Trend</CardTitle>
            <CardDescription>Cumulative over study period</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={ENROLLMENT_TREND}>
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
                <Area
                  type="monotone"
                  dataKey="enrolled"
                  name="Enrolled"
                  stroke="#6d28d9"
                  fill="url(#gEnrolled)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#10b981"
                  fill="url(#gCompleted)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="flagged"
                  name="Flagged"
                  stroke="#ef4444"
                  fill="url(#gFlagged)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Dimension score gauges */}
      <Card>
        <CardHeader>
          <CardTitle>Average Quality Dimensions</CardTitle>
          <CardDescription>
            Mean scores (0–100) across all evaluated responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-around py-4">
            {DIMENSION_SCORES.map((d) => (
              <CircleGauge
                key={d.label}
                score={d.score}
                color={d.color}
                label={d.label}
              />
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
            <strong className="text-foreground">Interpretation:</strong>{" "}
            Consistency leads at 81 — participants are largely coherent within
            their own responses. Effort (68) is the lowest dimension, suggesting
            some participants provided minimal engagement.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
