"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  Eye,
  EyeOff,
  Share2,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/analytics/overview-tab";
import { IntegrityTab } from "@/components/analytics/integrity-tab";
import { LinguisticTab } from "@/components/analytics/linguistic-tab";
import { GeographicTab } from "@/components/analytics/geographic-tab";
import { BehaviorTab } from "@/components/analytics/behavior-tab";
import { QuestionsTab } from "@/components/analytics/questions-tab";
import type { StudyDetail } from "@/types";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "integrity", label: "Integrity" },
  { value: "linguistic", label: "Linguistic" },
  { value: "geographic", label: "Geographic" },
  { value: "behavior", label: "Behavior" },
  { value: "questions", label: "Questions" },
];

const statusColors: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  ACTIVE: { border: "border-emerald-500/40", bg: "bg-emerald-500/20", text: "text-emerald-300", dot: "bg-emerald-400" },
  DRAFT: { border: "border-yellow-500/40", bg: "bg-yellow-500/20", text: "text-yellow-300", dot: "bg-yellow-400" },
  CLOSED: { border: "border-gray-500/40", bg: "bg-gray-500/20", text: "text-gray-300", dot: "bg-gray-400" },
};

export default function StudyDetailPage() {
  const { studyId } = useParams<{ studyId: string }>();
  const [study, setStudy] = useState<StudyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/studies/${studyId}`);
        if (res.ok) {
          const data = await res.json();
          setStudy(data.study);
        }
      } finally {
        setLoading(false);
      }
    }
    if (studyId) load();
  }, [studyId]);

  async function toggleStatus(newStatus: string) {
    const res = await fetch(`/api/studies/${studyId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok && study) {
      setStudy({ ...study, status: newStatus as StudyDetail["status"] });
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/study/${studyId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Loading study...</p>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-destructive">Study not found.</p>
      </div>
    );
  }

  const enrollmentCount = study.enrollments.length;
  const completedCount = study.enrollments.filter((e) => e.status === "COMPLETED").length;
  const flaggedCount = study.enrollments.filter((e) => e.flagged).length;
  const avgQuality =
    study.enrollments
      .filter((e) => e.averageQualityScore != null)
      .reduce((sum, e) => sum + (e.averageQualityScore ?? 0), 0) /
      (study.enrollments.filter((e) => e.averageQualityScore != null).length || 1);

  const sc = statusColors[study.status] ?? statusColors.DRAFT;

  const STATS = [
    { label: "Enrolled", value: String(enrollmentCount), sub: `/ ${study.targetCount} target`, icon: Users, color: "text-sky-300", bg: "bg-sky-500/20" },
    { label: "Completed", value: String(completedCount), sub: enrollmentCount ? `${Math.round((completedCount / enrollmentCount) * 100)}%` : "0%", icon: CheckCircle, color: "text-emerald-300", bg: "bg-emerald-500/20" },
    { label: "Flagged", value: String(flaggedCount), sub: enrollmentCount ? `${Math.round((flaggedCount / enrollmentCount) * 100)}%` : "0%", icon: AlertTriangle, color: "text-rose-300", bg: "bg-rose-500/20" },
    { label: "Avg Quality", value: avgQuality > 0 ? avgQuality.toFixed(2) : "—", sub: "score", icon: Star, color: "text-violet-300", bg: "bg-violet-500/20" },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <Tabs defaultValue="overview" className="flex-col">
        <div className="sticky top-0 z-50">
          <div className="bg-linear-to-r from-slate-900 via-violet-950 to-slate-900">
            <div className="mx-auto max-w-7xl px-6">
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10">
                      &larr; Back
                    </Button>
                  </Link>
                  <div className="h-5 w-px bg-white/15" />
                  <div>
                    <h1 className="text-xl font-bold text-white">{study.title}</h1>
                    <div className="mt-0.5 flex items-center gap-2.5 text-sm">
                      <span className={`inline-flex items-center gap-1 rounded-full border ${sc.border} ${sc.bg} px-2 py-0.5 text-xs font-medium ${sc.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sc.dot} ${study.status === "ACTIVE" ? "animate-pulse" : ""}`} />
                        {study.status}
                      </span>
                      <span className="text-white/50">{enrollmentCount} / {study.targetCount} enrolled</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {study.status === "DRAFT" && (
                    <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => toggleStatus("ACTIVE")}>
                      <Eye className="h-3.5 w-3.5" />
                      Activate
                    </Button>
                  )}
                  {study.status === "ACTIVE" && (
                    <Button size="sm" variant="ghost" className="gap-1.5 border border-white/15 text-white/70 hover:text-white hover:bg-white/10" onClick={() => toggleStatus("CLOSED")}>
                      <EyeOff className="h-3.5 w-3.5" />
                      Close
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1.5 border border-white/15 text-white/70 hover:text-white hover:bg-white/10" onClick={copyLink}>
                    {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-1 pb-4 overflow-x-auto">
                {STATS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="flex items-center gap-1">
                      {i > 0 && <div className="mx-3 h-6 w-px bg-white/10" />}
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${s.bg}`}>
                        <Icon className={`h-4 w-4 ${s.color}`} />
                        <span className="text-xl font-bold text-white tabular-nums">{s.value}</span>
                        <div>
                          <div className="text-xs font-medium text-white/80 leading-none">{s.label}</div>
                          <div className="text-[10px] text-white/40 leading-none mt-0.5">{s.sub}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-b bg-white shadow-sm">
            <div className="mx-auto max-w-7xl px-6">
              <TabsList variant="line" className="h-auto w-full justify-start rounded-none bg-transparent p-0 gap-0">
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

        <div className="mx-auto max-w-7xl px-6 py-10">
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="integrity"><IntegrityTab /></TabsContent>
          <TabsContent value="linguistic"><LinguisticTab /></TabsContent>
          <TabsContent value="geographic"><GeographicTab /></TabsContent>
          <TabsContent value="behavior"><BehaviorTab /></TabsContent>
          <TabsContent value="questions"><QuestionsTab questions={study.questions as Array<{ id: string; order: number; type: string; prompt: string; options?: string[] | null }>} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
