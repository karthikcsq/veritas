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

interface OverviewTabProps {
  qualityDistribution: { name: string; value: number; color: string }[];
  enrollmentTrend: { date: string; enrolled: number; completed: number; flagged: number }[];
  dimensionScores: { label: string; score: number; color: string }[];
}

function CircleGauge({
  score,
  color,
  label,
}: {
  score: number;
  color: string;
  label: string;
}) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={72} height={72} className="-rotate-90">
        <circle cx={36} cy={36} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
        <circle
          cx={36}
          cy={36}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <div className="text-lg font-bold tabular-nums" style={{ color }}>
          {score}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function OverviewTab({
  qualityDistribution,
  enrollmentTrend,
  dimensionScores,
}: OverviewTabProps) {
  const hasDistribution = qualityDistribution.some((d) => d.value > 0);
  const hasTrend = enrollmentTrend.length > 0;
  const hasDimensions = dimensionScores.length > 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-8">
        {/* Quality distribution donut */}
        <Card className="border-0 shadow-sm ring-1 ring-slate-200">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-lg">Response Quality Distribution</CardTitle>
            <CardDescription>
              Breakdown of responses by overall quality score
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {hasDistribution ? (
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={qualityDistribution}
                      cx={95}
                      cy={95}
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {qualityDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v} responses`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {qualityDistribution.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-sm text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-bold tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No scored responses yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enrollment trend */}
        <Card className="border-0 shadow-sm ring-1 ring-slate-200">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-lg">Enrollment Trend</CardTitle>
            <CardDescription>Daily enrollments, completions, and flags</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {hasTrend ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={enrollmentTrend}>
                  <defs>
                    <linearGradient id="gEnrolled" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6d28d9" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6d28d9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gFlagged" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} />
                  <Area type="monotone" dataKey="enrolled" stroke="#6d28d9" fill="url(#gEnrolled)" strokeWidth={2} name="Enrolled" />
                  <Area type="monotone" dataKey="completed" stroke="#10b981" fill="url(#gCompleted)" strokeWidth={2} name="Completed" />
                  <Area type="monotone" dataKey="flagged" stroke="#ef4444" fill="url(#gFlagged)" strokeWidth={2} name="Flagged" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No enrollment data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dimension score gauges */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="text-lg">Average Dimension Scores</CardTitle>
          <CardDescription>
            Mean scores across all scored responses (0–100)
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8">
          {hasDimensions ? (
            <div className="flex items-start justify-around pt-2">
              {dimensionScores.map((d) => (
                <CircleGauge key={d.label} score={d.score} color={d.color} label={d.label} />
              ))}
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center text-sm text-muted-foreground">
              No scored responses yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
