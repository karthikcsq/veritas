"use client";

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

const STATS = [
  {
    label: "Enrolled",
    value: "12",
    sub: "+2 today",
    icon: Users,
    color: "text-sky-300",
    bg: "bg-sky-500/20",
  },
  {
    label: "Completed",
    value: "8",
    sub: "66.7%",
    icon: CheckCircle,
    color: "text-emerald-300",
    bg: "bg-emerald-500/20",
  },
  {
    label: "Flagged",
    value: "3",
    sub: "25%",
    icon: AlertTriangle,
    color: "text-rose-300",
    bg: "bg-rose-500/20",
  },
  {
    label: "AI Detected",
    value: "3",
    sub: "of flagged",
    icon: Shield,
    color: "text-orange-300",
    bg: "bg-orange-500/20",
  },
  {
    label: "Avg Quality",
    value: "0.76",
    sub: "+0.04 this week",
    icon: Star,
    color: "text-[#5dade2]",
    bg: "bg-[#2874a6]/20",
  },
];

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "integrity", label: "Integrity" },
  { value: "linguistic", label: "Linguistic" },
  { value: "geographic", label: "Geographic" },
  { value: "behavior", label: "Behavior" },
  { value: "questions", label: "Questions" },
];

export default function StudyDetailPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow blobs for glass effect */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="ambient-blob-1 absolute -top-60 -left-60 h-[800px] w-[800px] rounded-full bg-[#1a5276]/20 blur-[150px]" />
        <div className="ambient-blob-2 absolute top-1/4 -right-40 h-[700px] w-[700px] rounded-full bg-[#2874a6]/15 blur-[130px]" />
        <div className="ambient-blob-3 absolute -bottom-60 left-1/4 h-[700px] w-[700px] rounded-full bg-[#1b4f72]/12 blur-[130px]" />
        <div className="ambient-blob-2 absolute top-2/3 left-1/2 h-[500px] w-[500px] rounded-full bg-[#21618c]/10 blur-[120px]" />
      </div>
      <Tabs defaultValue="overview" className="flex-col relative z-[1]">
        {/* ── Sticky top nav block ─────────────────────────────────── */}
        <div className="sticky top-0 z-50">
          {/* Gradient header */}
          <div className="bg-gradient-to-r from-slate-900 via-[#1a3d5c] to-slate-900">
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
                      Pain Management in Adults Over 50
                    </h1>
                    <div className="mt-0.5 flex items-center gap-2.5 text-sm">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ACTIVE
                      </span>
                      <span className="text-white/50">12 / 200 enrolled</span>
                      <span className="text-white/30">·</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Trending up
                      </span>
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
                    className="gap-1.5 bg-[#2874a6] text-white hover:bg-[#3498db]"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </Button>
                </div>
              </div>

              {/* Row 2: inline stat pills */}
              <div className="flex items-center gap-1 pb-4">
                {STATS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="flex items-center gap-1">
                      {i > 0 && (
                        <div className="mx-3 h-6 w-px bg-white/10" />
                      )}
                      <div
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${s.bg}`}
                      >
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
          <div className="border-b border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-6">
              <TabsList
                variant="line"
                className="h-auto w-full justify-start rounded-none bg-transparent p-0 gap-0"
              >
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-auto rounded-none border-b-2 border-transparent px-5 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-active:border-[#3498db] data-active:text-[#5dade2]"
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
            <OverviewTab />
          </TabsContent>
          <TabsContent value="integrity">
            <IntegrityTab />
          </TabsContent>
          <TabsContent value="linguistic">
            <LinguisticTab />
          </TabsContent>
          <TabsContent value="geographic">
            <GeographicTab />
          </TabsContent>
          <TabsContent value="behavior">
            <BehaviorTab />
          </TabsContent>
          <TabsContent value="questions">
            <QuestionsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
