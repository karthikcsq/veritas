"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  Share2,
  Shield,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/analytics/overview-tab";
import { IntegrityTab } from "@/components/analytics/integrity-tab";
import { LinguisticTab } from "@/components/analytics/linguistic-tab";
import { GeographicTab } from "@/components/analytics/geographic-tab";
import { BehaviorTab } from "@/components/analytics/behavior-tab";
import { QuestionsTab } from "@/components/analytics/questions-tab";

export type AnalyticsData = {
  study: { id: string; title: string; status: string; targetCount: number };
  stats: {
    totalEnrollments: number;
    completed: number;
    inProgress: number;
    flagged: number;
    averageQualityScore: number;
    averageSimilarityScore: number | null;
    qualityDistribution: { high: number; medium: number; low: number };
  };
  enrollmentTrend: { date: string; enrolled: number; completed: number; flagged: number }[];
  dimensionScores: { coherence: number; effort: number; consistency: number; similarity: number | null };
  enrollments: {
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
  }[];
  questionStats: {
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
  }[];
};

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "integrity", label: "Integrity" },
  { value: "linguistic", label: "Linguistic" },
  { value: "geographic", label: "Geographic" },
  { value: "behavior", label: "Behavior" },
  { value: "questions", label: "Questions" },
];

export default function StudyDetailPage() {
  const { studyId } = useParams<{ studyId: string }>();
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    if (!studyId) return;
    fetch(`/api/studies/${studyId}/analytics`)
      .then((r) => r.json())
      .then((result) => {
        if (result.error) {
          console.error("Analytics API error:", result.error);
        } else {
          setData(result);
        }
      })
      .catch(console.error);
  }, [studyId]);

  const stats = data?.stats;
  const study = data?.study;

  const STAT_PILLS = [
    {
      label: "Enrolled",
      value: stats ? String(stats.totalEnrollments) : "—",
      sub: stats
        ? `${stats.completed} completed`
        : "",
      icon: Users,
      color: "text-sky-300",
      bg: "bg-sky-500/20",
    },
    {
      label: "Completed",
      value: stats ? String(stats.completed) : "—",
      sub: stats && stats.totalEnrollments > 0
        ? `${((stats.completed / stats.totalEnrollments) * 100).toFixed(1)}%`
        : "",
      icon: CheckCircle,
      color: "text-emerald-300",
      bg: "bg-emerald-500/20",
    },
    {
      label: "Flagged",
      value: stats ? String(stats.flagged) : "—",
      sub: stats && stats.totalEnrollments > 0
        ? `${((stats.flagged / stats.totalEnrollments) * 100).toFixed(1)}% of total`
        : "",
      icon: AlertTriangle,
      color: "text-rose-300",
      bg: "bg-rose-500/20",
    },
    {
      label: "In Progress",
      value: stats ? String(stats.inProgress) : "—",
      sub: "active",
      icon: Shield,
      color: "text-orange-300",
      bg: "bg-orange-500/20",
    },
    {
      label: "Avg Quality",
      value: stats ? stats.averageQualityScore.toFixed(2) : "—",
      sub: stats?.averageSimilarityScore !== null && stats?.averageSimilarityScore !== undefined
        ? `sim ${stats.averageSimilarityScore.toFixed(2)}`
        : "quality score",
      icon: Star,
      color: "text-violet-300",
      bg: "bg-violet-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Tabs defaultValue="overview" className="flex-col">
        {/* ── Sticky top nav block ─────────────────────────────────── */}
        <div className="sticky top-0 z-50">
          {/* Gradient header */}
          <div className="bg-gradient-to-r from-slate-900 via-violet-950 to-slate-900">
            <div className="mx-auto max-w-7xl px-6">
              {/* Row 1: back + title + actions */}
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <Link href="/dashboard">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/60 hover:text-white hover:bg-white/10"
                    >
                      ← Back
                    </Button>
                  </Link>
                  <div className="h-5 w-px bg-white/15" />
                  <div>
                    <h1 className="text-xl font-bold text-white">
                      {study?.title ?? "Loading…"}
                    </h1>
                    <div className="mt-0.5 flex items-center gap-2.5 text-sm">
                      {study && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                            study.status === "ACTIVE"
                              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                              : "border-slate-500/40 bg-slate-500/20 text-slate-300"
                          }`}
                        >
                          {study.status === "ACTIVE" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          {study.status}
                        </span>
                      )}
                      {stats && study && (
                        <>
                          <span className="text-white/50">
                            {stats.totalEnrollments} / {study.targetCount} enrolled
                          </span>
                          <span className="text-white/30">·</span>
                          <span className="flex items-center gap-1 text-emerald-400">
                            <TrendingUp className="h-3.5 w-3.5" />
                            {stats.completed} completed
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 border border-white/15 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-violet-500 text-white hover:bg-violet-400"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </Button>
                </div>
              </div>

              {/* Row 2: stat pills */}
              <div className="flex items-center gap-1 pb-4">
                {STAT_PILLS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="flex items-center gap-1">
                      {i > 0 && <div className="mx-3 h-6 w-px bg-white/10" />}
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${s.bg}`}>
                        <Icon className={`h-4 w-4 ${s.color}`} />
                        <span className="text-xl font-bold text-white tabular-nums">
                          {s.value}
                        </span>
                        <div>
                          <div className="text-xs font-medium text-white/80 leading-none">
                            {s.label}
                          </div>
                          <div className="text-[10px] text-white/40 leading-none mt-0.5">
                            {s.sub}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="border-b bg-white shadow-sm">
            <div className="mx-auto max-w-7xl px-6">
              <TabsList
                variant="line"
                className="h-auto w-full justify-start rounded-none bg-transparent p-0 gap-0"
              >
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-auto rounded-none border-b-2 border-transparent px-5 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-active:border-violet-600 data-active:text-violet-700"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>
        </div>

        {/* ── Scrollable content ────────────────────────────────────── */}
        <div className="mx-auto max-w-7xl px-6 py-10">
          <TabsContent value="overview">
            <OverviewTab
              qualityDistribution={
                stats
                  ? [
                      { name: "High Quality", value: stats.qualityDistribution.high, color: "#10b981" },
                      { name: "Moderate", value: stats.qualityDistribution.medium, color: "#f59e0b" },
                      { name: "Low Quality", value: stats.qualityDistribution.low, color: "#ef4444" },
                    ]
                  : []
              }
              enrollmentTrend={data?.enrollmentTrend ?? []}
              dimensionScores={
                data?.dimensionScores
                  ? [
                      { label: "Coherence", score: data.dimensionScores.coherence ?? 0, color: "#6d28d9" },
                      { label: "Effort", score: data.dimensionScores.effort ?? 0, color: "#2563eb" },
                      { label: "Consistency", score: data.dimensionScores.consistency ?? 0, color: "#059669" },
                      ...(data.dimensionScores.similarity !== null && data.dimensionScores.similarity !== undefined
                        ? [{ label: "Similarity", score: data.dimensionScores.similarity, color: "#db2777" }]
                        : []),
                    ]
                  : []
              }
            />
          </TabsContent>
          <TabsContent value="integrity">
            <IntegrityTab enrollments={data?.enrollments ?? []} />
          </TabsContent>
          <TabsContent value="linguistic">
            <LinguisticTab
              enrollments={data?.enrollments ?? []}
              questionStats={data?.questionStats ?? []}
            />
          </TabsContent>
          <TabsContent value="geographic">
            <GeographicTab />
          </TabsContent>
          <TabsContent value="behavior">
            <BehaviorTab />
          </TabsContent>
          <TabsContent value="questions">
            <QuestionsTab
              questionStats={data?.questionStats ?? []}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
