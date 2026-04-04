"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { StudyListItem } from "@/types";

const statusColor = {
  DRAFT: "secondary",
  ACTIVE: "default",
  CLOSED: "outline",
} as const;

export default function DashboardPage() {
  const [studies, setStudies] = useState<StudyListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/studies");
        if (res.ok) {
          const data = await res.json();
          setStudies(data.studies);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalEnrollments = studies.reduce((s, st) => s + st.enrollmentCount, 0);
  const totalCompleted = studies.reduce((s, st) => s + st.completedCount, 0);
  const totalFlagged = studies.reduce((s, st) => s + st.flaggedCount, 0);

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Your Studies</h1>
          <p className="text-muted-foreground">
            Manage studies and monitor participant quality
          </p>
        </div>
        <Link href="/dashboard/studies/new">
          <Button>Create Study</Button>
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Studies", value: String(studies.length) },
          { label: "Active Enrollments", value: String(totalEnrollments) },
          { label: "Completed", value: String(totalCompleted) },
          { label: "Flagged", value: String(totalFlagged) },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading studies...</p>
      ) : studies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              You haven&apos;t created any studies yet.
            </p>
            <Link href="/dashboard/studies/new">
              <Button>Create your first study</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {studies.map((study) => (
            <Link key={study.id} href={`/dashboard/studies/${study.id}`}>
              <Card className="hover:border-foreground/20 transition-colors cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{study.title}</h3>
                        <Badge variant={statusColor[study.status]}>
                          {study.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Target: {study.targetCount} participants
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-semibold">{study.enrollmentCount}</div>
                        <div className="text-muted-foreground">Enrolled</div>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div className="text-center">
                        <div className="font-semibold">{study.completedCount}</div>
                        <div className="text-muted-foreground">Completed</div>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div className="text-center">
                        <div className="font-semibold text-destructive">{study.flaggedCount}</div>
                        <div className="text-muted-foreground">Flagged</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
