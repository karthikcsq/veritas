"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Info,
  Shield,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalyticsData, AnalyticsEnrollment, AnalyticsResponseDetail } from "@/types";

function ScoreBar({
  value,
  invert = false,
  thresholdHigh = 0.6,
  thresholdMid = 0.3,
}: {
  value: number;
  invert?: boolean;
  thresholdHigh?: number;
  thresholdMid?: number;
}) {
  const effective = invert ? 1 - value : value;
  const color =
    effective > thresholdHigh
      ? "bg-rose-500"
      : effective > thresholdMid
      ? "bg-amber-400"
      : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs tabular-nums">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function WhyTooltip({ reason }: { reason: string }) {
  const [open, setOpen] = useState(false);
  const bullets = reason.split(";").map((s) => s.trim()).filter(Boolean);
  return (
    <span className="relative inline-flex">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-muted-foreground transition-colors hover:text-rose-500"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span className="absolute left-5 top-0 z-50 w-56 rounded-lg border bg-popover p-3 text-xs shadow-xl">
          <span className="mb-1.5 block font-semibold text-rose-600">Flagged for</span>
          <ul className="space-y-1">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                {b}
              </li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
}

export function IntegrityTab({ data }: { data: AnalyticsData | null }) {
  const [showOnlyClean, setShowOnlyClean] = useState(false);
  const [selected, setSelected] = useState<{
    enrollment: AnalyticsEnrollment;
    responses: AnalyticsResponseDetail[];
  } | null>(null);

  if (!data) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Loading analytics...</p>;
  }

  const { enrollments, responsesByEnrollment } = data;

  const flagged = enrollments.filter((e) => e.status === "FLAGGED");
  const lowQuality = enrollments.filter((e) => e.avgOverall !== null && e.avgOverall < 0.45);
  const highQuality = enrollments.filter(
    (e) => e.status === "COMPLETED" && e.avgOverall !== null && e.avgOverall >= 0.7
  );
  const valid = enrollments.filter(
    (e) => e.status === "COMPLETED" && !e.hasFlaggedResponse
  );

  const rows = showOnlyClean
    ? enrollments.filter((e) => e.status === "COMPLETED" && !e.hasFlaggedResponse)
    : enrollments;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-4 gap-6">
        <Card className="border-0 shadow-sm ring-2 ring-rose-200 bg-linear-to-br from-rose-50 to-red-50">
          <CardContent className="flex items-center justify-between px-6 pt-6 pb-6">
            <div>
              <div className="text-4xl font-bold text-rose-600 tabular-nums">{flagged.length}</div>
              <div className="mt-1 text-sm font-semibold text-rose-700/80">Flagged Responses</div>
              <div className="mt-1 text-xs text-rose-600/60">
                {enrollments.length > 0 ? ((flagged.length / enrollments.length) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15">
              <AlertTriangle className="h-7 w-7 text-rose-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-2 ring-orange-200 bg-linear-to-br from-orange-50 to-amber-50">
          <CardContent className="flex items-center justify-between px-6 pt-6 pb-6">
            <div>
              <div className="text-4xl font-bold text-orange-600 tabular-nums">{lowQuality.length}</div>
              <div className="mt-1 text-sm font-semibold text-orange-700/80">Low Quality</div>
              <div className="mt-1 text-xs text-orange-600/60">Score below 45%</div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15">
              <Shield className="h-7 w-7 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-2 ring-amber-200 bg-linear-to-br from-amber-50 to-yellow-50">
          <CardContent className="flex items-center justify-between px-6 pt-6 pb-6">
            <div>
              <div className="text-4xl font-bold text-amber-600 tabular-nums">{highQuality.length}</div>
              <div className="mt-1 text-sm font-semibold text-amber-700/80">High Quality</div>
              <div className="mt-1 text-xs text-amber-600/60">Score above 70%</div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15">
              <Bot className="h-7 w-7 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-2 ring-emerald-200 bg-linear-to-br from-emerald-50 to-green-50">
          <CardContent className="flex items-center justify-between px-6 pt-6 pb-6">
            <div>
              <div className="text-4xl font-bold text-emerald-600 tabular-nums">{valid.length}</div>
              <div className="mt-1 text-sm font-semibold text-emerald-700/80">Valid Responses</div>
              <div className="mt-1 text-xs text-emerald-600/60">Passed all integrity checks</div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
              <CheckCircle className="h-7 w-7 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="flex flex-row items-start justify-between px-6 pt-6">
          <div>
            <CardTitle className="text-lg">Participant Integrity Scores</CardTitle>
            <CardDescription>
              Hover <Info className="inline h-3 w-3 text-rose-500" /> on flagged rows for reason &middot; Click a row to view all responses
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-sm text-muted-foreground">Clean data only</span>
            <button
              onClick={() => setShowOnlyClean(!showOnlyClean)}
              className={`relative h-6 w-11 rounded-full transition-colors ${showOnlyClean ? "bg-emerald-500" : "bg-slate-200"}`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showOnlyClean ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-[140px_100px_1fr_1fr_1fr_80px] gap-4 border-b px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div>Participant</div>
            <div>Status</div>
            <div>Coherence</div>
            <div>Effort</div>
            <div>Consistency</div>
            <div>Action</div>
          </div>
          {rows.map((e) => {
            const responses = responsesByEnrollment[e.id] ?? [];
            return (
              <div
                key={e.id}
                onClick={() => responses.length > 0 && setSelected({ enrollment: e, responses })}
                className={`grid grid-cols-[140px_100px_1fr_1fr_1fr_80px] items-center gap-4 border-b px-3 py-4 text-sm last:border-0 transition-colors ${
                  e.status === "FLAGGED" ? "bg-rose-50/60 hover:bg-rose-50" : "hover:bg-slate-50"
                } ${responses.length > 0 ? "cursor-pointer" : ""}`}
              >
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{e.id.slice(0, 8)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge
                    variant={e.status === "FLAGGED" ? "destructive" : e.status === "COMPLETED" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {e.status}
                  </Badge>
                  {e.flagReasons && <WhyTooltip reason={e.flagReasons} />}
                </div>
                <div>
                  {e.avgCoherence !== null ? (
                    <ScoreBar value={e.avgCoherence} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </div>
                <div>
                  {e.avgEffort !== null ? (
                    <ScoreBar value={e.avgEffort} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </div>
                <div>
                  {e.avgConsistency !== null ? (
                    <ScoreBar value={e.avgConsistency} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </div>
                <div>
                  {responses.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">View</Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-0 shadow-sm ring-2 ring-violet-200 bg-linear-to-br from-violet-50/40 to-purple-50/40">
          <CardHeader className="flex flex-row items-start justify-between px-6 pt-6 pb-4">
            <div>
              <CardTitle>Response Details</CardTitle>
              <CardDescription>
                Participant {selected.enrollment.id.slice(0, 8)} &middot; Overall Quality Score:{" "}
                <strong
                  className={
                    selected.enrollment.avgOverall !== null && selected.enrollment.avgOverall < 0.45
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }
                >
                  {selected.enrollment.avgOverall?.toFixed(2) ?? "N/A"}
                </strong>
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6 px-6 pb-6">
            {selected.responses.map((r, i) => (
              <div key={i}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {r.question}
                  </span>
                  {r.flagged && (
                    <Badge variant="destructive" className="text-[10px]">Flagged</Badge>
                  )}
                  {r.score !== null && (
                    <Badge className={`text-[10px] ${r.score >= 0.7 ? "bg-emerald-100 text-emerald-700" : r.score >= 0.45 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                      {(r.score * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
                <div className="rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm leading-relaxed">{r.answer}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
