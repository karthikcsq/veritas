"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Shield,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    label: "Total Enrolled",
    value: "12",
    sub: "+2 today",
    icon: Users,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    label: "Completed",
    value: "8",
    sub: "66.7% completion",
    icon: CheckCircle,
    gradient: "from-emerald-500 to-green-500",
  },
  {
    label: "Flagged",
    value: "3",
    sub: "25% flag rate",
    icon: AlertTriangle,
    gradient: "from-rose-500 to-red-500",
  },
  {
    label: "AI Detected",
    value: "3",
    sub: "All 3 overlapping flagged",
    icon: Shield,
    gradient: "from-orange-500 to-amber-500",
  },
  {
    label: "Avg Quality",
    value: "0.76",
    sub: "+0.04 vs last week",
    icon: Star,
    gradient: "from-violet-500 to-purple-500",
  },
];

export default function StudyDetailPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                ← Back
              </Button>
            </Link>
            <div className="h-5 w-px bg-border" />
            <div>
              <h1 className="text-lg font-bold leading-tight">
                Pain Management in Adults Over 50
              </h1>
              <div className="mt-0.5 flex items-center gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20">
                  ACTIVE
                </Badge>
                <span className="text-sm text-muted-foreground">
                  12 / 200 enrolled
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-1 text-sm text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Trending up
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Export Report
            </Button>
            <Button variant="outline" size="sm">
              Close Study
            </Button>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              Share Link
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-5 gap-4">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="group relative overflow-hidden rounded-xl border bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-0 transition-opacity group-hover:opacity-5`}
                />
                <div
                  className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${s.gradient}`}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                <div className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground/70">
                  {s.sub}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="h-auto gap-1 border bg-white p-1">
            <TabsTrigger value="overview" className="rounded-md px-4 py-2 text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="integrity" className="rounded-md px-4 py-2 text-sm">
              Integrity
            </TabsTrigger>
            <TabsTrigger value="linguistic" className="rounded-md px-4 py-2 text-sm">
              Linguistic
            </TabsTrigger>
            <TabsTrigger value="geographic" className="rounded-md px-4 py-2 text-sm">
              Geographic
            </TabsTrigger>
            <TabsTrigger value="behavior" className="rounded-md px-4 py-2 text-sm">
              Behavior
            </TabsTrigger>
            <TabsTrigger value="questions" className="rounded-md px-4 py-2 text-sm">
              Questions
            </TabsTrigger>
          </TabsList>

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
        </Tabs>
      </div>
    </div>
  );
}
