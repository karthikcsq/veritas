"use client";

import { useState } from "react";
import {
  AlertTriangle,
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

type EnrollmentRow = {
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
};

interface IntegrityTabProps {
  enrollments: EnrollmentRow[];
}

function ScoreBar({
  value,
  invert = false,
}: {
  value: number;
  invert?: boolean;
}) {
  const pct = value * 100;
  const color = invert
    ? value > 0.6 ? "bg-rose-500" : value > 0.3 ? "bg-amber-400" : "bg-emerald-400"
    : value >= 0.7 ? "bg-emerald-500" : value >= 0.45 ? "bg-amber-400" : "bg-rose-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs tabular-nums">
        {pct.toFixed(0)}%
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
        <span className="absolute left-5 top-0 z-50 w-72 rounded-lg border bg-popover p-3 text-xs shadow-xl">
          <span className="mb-1.5 block font-semibold text-rose-600">Flag Reason</span>
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

export function IntegrityTab({ enrollments }: IntegrityTabProps) {
  const [showOnlyClean, setShowOnlyClean] = useState(false);
  const [selected, setSelected] = useState<EnrollmentRow | null>(null);

  const flaggedList = enrollments.filter((e) => e.flagged || e.status === "FLAGGED");
  const lowSimilarity = enrollments.filter(
    (e) => e.similarityScore !== null && e.similarityScore < 0.5
  );
  const valid = enrollments.filter(
    (e) => e.status === "COMPLETED" && !e.flagged
  );

  const rows = showOnlyClean
    ? enrollments.filter((e) => e.status === "COMPLETED" && !e.flagged)
    : enrollments;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-4 gap-6">
        <Card className="border-0 shadow-sm ring-1 ring-rose-500/30 bg-linear-to-br from-rose-950/30 to-red-950/20">
          <CardContent className="flex items-center justify-between px-6 pt-6 pb-6">
            <div>
              <div className="text-4xl font-bold text-rose-400 tabular-nums">
                {flaggedList.length}
              </div>
              <div className="mt-1 text-sm font-semibold text-rose-300/80">
                Flagged Responses
              </div>
              <div className="mt-1 text-xs text-rose-400/60">
                {enrollments.length > 0
                  ? `${((flaggedList.length / enrollments.length) * 100).toFixed(1)}% of total`
                  : "no data"}
              </div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15">
              <AlertTriangle className="h-7 w-7 text-rose-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-orange-500/30 bg-linear-to-br from-orange-950/30 to-amber-950/20">
          <CardContent className="flex items-center justify-between px-6 pt-6 pb-6">
            <div>
              <div className="text-4xl font-bold text-orange-400 tabular-nums">
                {lowSimilarity.length}
              </div>
              <div className="mt-1 text-sm font-semibold text-orange-300/80">
                Low Similarity
              </div>
              <div className="mt-1 text-xs text-orange-400/60">
                Atypical vs. peers
              </div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15">
              <Shield className="h-7 w-7 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-amber-500/30 bg-linear-to-br from-amber-950/30 to-yellow-950/20">
          <CardContent className="flex items-center justify-between px-6 pt-6 pb-6">
            <div>
              <div className="text-4xl font-bold text-amber-400 tabular-nums">
                {enrollments.filter((e) => e.status === "IN_PROGRESS").length}
              </div>
              <div className="mt-1 text-sm font-semibold text-amber-300/80">
                In Progress
              </div>
              <div className="mt-1 text-xs text-amber-400/60">
                Not yet scored
              </div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15">
              <Info className="h-7 w-7 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-emerald-500/30 bg-linear-to-br from-emerald-950/30 to-green-950/20">
          <CardContent className="flex items-center justify-between px-6 pt-6 pb-6">
            <div>
              <div className="text-4xl font-bold text-emerald-400 tabular-nums">
                {valid.length}
              </div>
              <div className="mt-1 text-sm font-semibold text-emerald-300/80">
                Valid Responses
              </div>
              <div className="mt-1 text-xs text-emerald-400/60">
                Passed all checks
              </div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
              <CheckCircle className="h-7 w-7 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-white/10">
        <CardHeader className="flex flex-row items-start justify-between px-6 pt-6">
          <div>
            <CardTitle className="text-lg">Participant Integrity Scores</CardTitle>
            <CardDescription>
              Hover <Info className="inline h-3 w-3 text-rose-500" /> on flagged
              rows for reason · Click a row to inspect responses
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
          {enrollments.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No enrollments yet
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[160px_120px_1fr_1fr_80px] gap-4 border-b px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div>Participant</div>
                <div>Status</div>
                <div>Quality Score</div>
                <div>Similarity</div>
                <div>Action</div>
              </div>
              {rows.map((e) => (
                <div
                  key={e.id}
                  onClick={() => e.responses.length > 0 && setSelected(e)}
                  className={`grid grid-cols-[160px_120px_1fr_1fr_80px] items-center gap-4 border-b px-3 py-4 text-sm last:border-0 transition-colors ${
                    e.flagged || e.status === "FLAGGED"
                      ? "bg-rose-500/10 hover:bg-rose-500/15"
                      : "hover:bg-white/5"
                  } ${e.responses.length > 0 ? "cursor-pointer" : ""}`}
                >
                  <div className="font-mono text-xs text-muted-foreground truncate">
                    {e.id}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={
                        e.status === "FLAGGED"
                          ? "destructive"
                          : e.status === "COMPLETED"
                          ? "default"
                          : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {e.status}
                    </Badge>
                    {e.flagReason && <WhyTooltip reason={e.flagReason} />}
                  </div>
                  <div>
                    {e.overallScore !== null ? (
                      <ScoreBar value={e.overallScore} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </div>
                  <div>
                    {e.similarityScore !== null ? (
                      <ScoreBar value={e.similarityScore} />
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </div>
                  <div>
                    {e.responses.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        Inspect
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-0 shadow-sm ring-1 ring-violet-500/30 bg-linear-to-br from-violet-950/30 to-purple-950/20">
          <CardHeader className="flex flex-row items-start justify-between px-6 pt-6 pb-4">
            <div>
              <CardTitle>Response Inspection</CardTitle>
              <CardDescription>
                Participant{" "}
                <span className="font-mono">{selected.id}</span> · Overall:{" "}
                <strong
                  className={
                    selected.overallScore !== null && selected.overallScore < 0.45
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }
                >
                  {selected.overallScore?.toFixed(2) ?? "—"}
                </strong>
                {selected.similarityScore !== null && (
                  <>
                    {" "}· Similarity:{" "}
                    <strong
                      className={
                        selected.similarityScore < 0.5 ? "text-rose-600" : "text-emerald-600"
                      }
                    >
                      {selected.similarityScore.toFixed(2)}
                    </strong>
                  </>
                )}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-5 px-6 pb-6">
            {selected.responses.map((r, i) => (
              <div key={i}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {r.questionPrompt}
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Response
                    </span>
                    {r.timeSpentMs !== null && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {Math.round(r.timeSpentMs / 1000)}s · {r.wordCount} words
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{r.value || <em className="text-muted-foreground">No response</em>}</p>
                </div>
              </div>
            ))}
            {selected.similarityReason && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  Similarity Flag
                </div>
                <p className="text-sm leading-relaxed text-rose-300">{selected.similarityReason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
