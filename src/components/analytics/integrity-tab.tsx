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

type Enrollment = {
  id: string;
  status: string;
  country: string;
  aiScore: number | null;
  botScore: number | null;
  consistencyScore: number | null;
  quality: number | null;
  flagReason: string | null;
  answers: { question: string; answer: string; ideal: string }[];
};

const ENROLLMENTS: Enrollment[] = [
  {
    id: "e-4f2a",
    status: "COMPLETED",
    country: "🇺🇸 US",
    aiScore: 0.12,
    botScore: 0.08,
    consistencyScore: 0.94,
    quality: 0.91,
    flagReason: null,
    answers: [
      {
        question: "Daily pain rating (1–10)",
        answer: "7",
        ideal: "6.8 (avg across valid responses)",
      },
      {
        question: "How pain affects your daily activities",
        answer:
          "I wake up most mornings with significant stiffness in my lower back. By midday, standing for more than 20 minutes becomes painful, so I have to sit or lean against something. Grocery shopping now takes twice as long.",
        ideal:
          "Chronic pain significantly limits routine tasks like walking, sleeping, and concentrating at work. Most participants report needing to modify activities and take rest breaks throughout the day.",
      },
      {
        question: "Pain management methods tried",
        answer: "Physical therapy, Medication",
        ideal: "Physical therapy (74%), Medication (68%), Exercise (52%)",
      },
    ],
  },
  {
    id: "e-7b1c",
    status: "COMPLETED",
    country: "🇬🇧 UK",
    aiScore: 0.18,
    botScore: 0.11,
    consistencyScore: 0.87,
    quality: 0.84,
    flagReason: null,
    answers: [
      {
        question: "Daily pain rating (1–10)",
        answer: "5",
        ideal: "6.8 (avg across valid responses)",
      },
      {
        question: "How pain affects your daily activities",
        answer:
          "The pain mainly affects me when climbing stairs or bending down. I've had to give up gardening, which I used to love, because I can't kneel for more than a minute without sharp pain shooting up my knee.",
        ideal:
          "Chronic pain significantly limits routine tasks like walking, sleeping, and concentrating at work. Most participants report needing to modify activities and take rest breaks throughout the day.",
      },
      {
        question: "Pain management methods tried",
        answer: "Acupuncture, Exercise",
        ideal: "Physical therapy (74%), Medication (68%), Exercise (52%)",
      },
    ],
  },
  {
    id: "e-2d9e",
    status: "FLAGGED",
    country: "🇮🇳 IN",
    aiScore: 0.89,
    botScore: 0.76,
    consistencyScore: 0.31,
    quality: 0.32,
    flagReason:
      "Response time 340% faster than average; high AI authorship likelihood (89%); generic phrasing inconsistent with lived experience",
    answers: [
      {
        question: "Daily pain rating (1–10)",
        answer: "3",
        ideal: "6.8 (avg across valid responses)",
      },
      {
        question: "How pain affects your daily activities",
        answer:
          "Pain management is a complex medical topic that affects millions of adults globally. Various therapeutic interventions have demonstrated efficacy in clinical settings for managing chronic conditions.",
        ideal:
          "Chronic pain significantly limits routine tasks like walking, sleeping, and concentrating at work. Most participants report needing to modify activities and take rest breaks throughout the day.",
      },
      {
        question: "Pain management methods tried",
        answer: "Medication",
        ideal: "Physical therapy (74%), Medication (68%), Exercise (52%)",
      },
    ],
  },
  {
    id: "e-8c3f",
    status: "COMPLETED",
    country: "🇩🇪 DE",
    aiScore: 0.09,
    botScore: 0.05,
    consistencyScore: 0.92,
    quality: 0.88,
    flagReason: null,
    answers: [],
  },
  {
    id: "e-1a5b",
    status: "FLAGGED",
    country: "🇺🇸 US",
    aiScore: 0.94,
    botScore: 0.82,
    consistencyScore: 0.28,
    quality: 0.28,
    flagReason:
      "Answer to Q4 contradicts Q2; survey completed in 12s (study avg: 312s); identical phrasing detected across 2 other flagged submissions",
    answers: [],
  },
  {
    id: "e-6e7d",
    status: "COMPLETED",
    country: "🇯🇵 JP",
    aiScore: 0.15,
    botScore: 0.09,
    consistencyScore: 0.96,
    quality: 0.93,
    flagReason: null,
    answers: [],
  },
  {
    id: "e-3f8a",
    status: "COMPLETED",
    country: "🇨🇦 CA",
    aiScore: 0.31,
    botScore: 0.19,
    consistencyScore: 0.78,
    quality: 0.72,
    flagReason: null,
    answers: [],
  },
  {
    id: "e-9g2h",
    status: "FLAGGED",
    country: "🇺🇸 US",
    aiScore: 0.78,
    botScore: 0.65,
    consistencyScore: 0.44,
    quality: 0.41,
    flagReason:
      "Mouse movement entropy score 0.11 (threshold: 0.40); automated browser fingerprint detected; response timing variance near zero",
    answers: [],
  },
  {
    id: "e-5h4i",
    status: "COMPLETED",
    country: "🇮🇳 IN",
    aiScore: 0.11,
    botScore: 0.07,
    consistencyScore: 0.89,
    quality: 0.86,
    flagReason: null,
    answers: [],
  },
  {
    id: "e-0i6j",
    status: "COMPLETED",
    country: "🇦🇺 AU",
    aiScore: 0.19,
    botScore: 0.13,
    consistencyScore: 0.83,
    quality: 0.79,
    flagReason: null,
    answers: [],
  },
  {
    id: "e-7j8k",
    status: "IN_PROGRESS",
    country: "🇫🇷 FR",
    aiScore: null,
    botScore: null,
    consistencyScore: null,
    quality: null,
    flagReason: null,
    answers: [],
  },
  {
    id: "e-2k0l",
    status: "COMPLETED",
    country: "🇧🇷 BR",
    aiScore: 0.22,
    botScore: 0.14,
    consistencyScore: 0.76,
    quality: 0.77,
    flagReason: null,
    answers: [],
  },
];

function ScoreBar({
  value,
  thresholdHigh = 0.6,
  thresholdMid = 0.3,
}: {
  value: number;
  thresholdHigh?: number;
  thresholdMid?: number;
}) {
  const color =
    value > thresholdHigh
      ? "bg-rose-500"
      : value > thresholdMid
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
          <span className="mb-1 block font-semibold text-rose-600">
            Flag Reason
          </span>
          {reason}
        </span>
      )}
    </span>
  );
}

export function IntegrityTab() {
  const [showOnlyClean, setShowOnlyClean] = useState(false);
  const [selected, setSelected] = useState<Enrollment | null>(null);

  const flagged = ENROLLMENTS.filter((e) => e.status === "FLAGGED");
  const aiDetected = ENROLLMENTS.filter(
    (e) => e.aiScore !== null && e.aiScore > 0.6
  );
  const botDetected = ENROLLMENTS.filter(
    (e) => e.botScore !== null && e.botScore > 0.5
  );
  const valid = ENROLLMENTS.filter(
    (e) => e.status === "COMPLETED" && !e.flagReason
  );

  const rows = showOnlyClean
    ? ENROLLMENTS.filter(
        (e) => e.status === "COMPLETED" && !e.flagReason
      )
    : ENROLLMENTS;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-rose-200 bg-rose-50/60">
          <CardContent className="flex items-center justify-between pt-5 pb-5">
            <div>
              <div className="text-3xl font-bold text-rose-600">
                {flagged.length}
              </div>
              <div className="text-sm font-medium text-rose-700/80">
                Flagged Responses
              </div>
              <div className="mt-1 text-xs text-rose-600/60">
                {((flagged.length / ENROLLMENTS.length) * 100).toFixed(1)}% of
                total
              </div>
            </div>
            <AlertTriangle className="h-9 w-9 text-rose-300" />
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/60">
          <CardContent className="flex items-center justify-between pt-5 pb-5">
            <div>
              <div className="text-3xl font-bold text-orange-600">
                {aiDetected.length}
              </div>
              <div className="text-sm font-medium text-orange-700/80">
                AI-Generated
              </div>
              <div className="mt-1 text-xs text-orange-600/60">
                {((aiDetected.length / ENROLLMENTS.length) * 100).toFixed(1)}%
                detection rate
              </div>
            </div>
            <Shield className="h-9 w-9 text-orange-300" />
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-center justify-between pt-5 pb-5">
            <div>
              <div className="text-3xl font-bold text-amber-600">
                {botDetected.length}
              </div>
              <div className="text-sm font-medium text-amber-700/80">
                Bot-Like Behavior
              </div>
              <div className="mt-1 text-xs text-amber-600/60">
                Low entropy patterns
              </div>
            </div>
            <Bot className="h-9 w-9 text-amber-300" />
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="flex items-center justify-between pt-5 pb-5">
            <div>
              <div className="text-3xl font-bold text-emerald-600">
                {valid.length}
              </div>
              <div className="text-sm font-medium text-emerald-700/80">
                Valid Responses
              </div>
              <div className="mt-1 text-xs text-emerald-600/60">
                Passed all integrity checks
              </div>
            </div>
            <CheckCircle className="h-9 w-9 text-emerald-300" />
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Participant Integrity Scores</CardTitle>
            <CardDescription>
              Hover{" "}
              <Info className="inline h-3 w-3 text-rose-500" /> on flagged rows
              for reason · Click a row with answers to compare
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-sm text-muted-foreground">
              Clean data only
            </span>
            <button
              onClick={() => setShowOnlyClean(!showOnlyClean)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                showOnlyClean ? "bg-emerald-500" : "bg-slate-200"
              }`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  showOnlyClean ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[140px_120px_1fr_1fr_80px] gap-4 border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div>Participant</div>
            <div>Status</div>
            <div>AI Detection</div>
            <div>Bot Detection</div>
            <div>Action</div>
          </div>
          {rows.map((e) => (
            <div
              key={e.id}
              onClick={() => e.answers.length > 0 && setSelected(e)}
              className={`grid grid-cols-[140px_120px_1fr_1fr_80px] items-center gap-4 border-b px-3 py-3 text-sm last:border-0 transition-colors ${
                e.status === "FLAGGED"
                  ? "bg-rose-50/60 hover:bg-rose-50"
                  : "hover:bg-slate-50"
              } ${e.answers.length > 0 ? "cursor-pointer" : ""}`}
            >
              <div>
                <div className="font-mono text-xs text-muted-foreground">
                  {e.id}
                </div>
                <div className="mt-0.5 text-[11px]">{e.country}</div>
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
                {e.aiScore !== null ? (
                  <ScoreBar value={e.aiScore} />
                ) : (
                  <span className="text-xs text-muted-foreground">Pending</span>
                )}
              </div>
              <div>
                {e.botScore !== null ? (
                  <ScoreBar value={e.botScore} thresholdHigh={0.5} thresholdMid={0.25} />
                ) : (
                  <span className="text-xs text-muted-foreground">Pending</span>
                )}
              </div>
              <div>
                {e.answers.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    Compare
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Side-by-side comparison */}
      {selected && (
        <Card className="border-violet-200 bg-violet-50/20">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div>
              <CardTitle>Side-by-Side Comparison</CardTitle>
              <CardDescription>
                Participant {selected.id} · Overall Quality Score:{" "}
                <strong
                  className={
                    selected.quality !== null && selected.quality < 0.45
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }
                >
                  {selected.quality?.toFixed(2)}
                </strong>
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected.answers.map((a, i) => (
              <div key={i}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {a.question}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-white p-4">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Participant Response
                    </div>
                    <p className="text-sm leading-relaxed">{a.answer}</p>
                  </div>
                  <div className="rounded-lg border border-dashed bg-slate-50 p-4">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-600">
                      Avg High-Quality Response
                    </div>
                    <p className="text-sm leading-relaxed italic text-muted-foreground">
                      {a.ideal}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
