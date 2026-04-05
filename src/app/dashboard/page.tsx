"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { signOut, useSession } from "next-auth/react";

type Study = {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  targetCount: number;
  enrollmentCount: number;
  completedCount: number;
  flaggedCount: number;
};

const statusColor = {
  DRAFT: "secondary",
  ACTIVE: "default",
  CLOSED: "outline",
} as const;

export default function DashboardPage() {
  const { data: session } = useSession();
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/studies")
      .then((r) => r.json())
      .then((data) => {
        setStudies(data.studies ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalEnrollments = studies.reduce((s, st) => s + st.enrollmentCount, 0);
  const totalCompleted = studies.reduce((s, st) => s + st.completedCount, 0);
  const totalFlagged = studies.reduce((s, st) => s + st.flaggedCount, 0);

  const userName = (session?.user as { name?: string } | undefined)?.name
    ?? (session?.user as { email?: string } | undefined)?.email
    ?? "Researcher";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow blobs for glass to blur against */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="ambient-blob-1 absolute -top-60 -left-60 h-[800px] w-[800px] rounded-full bg-[#1a5276]/20 blur-[150px]" />
        <div className="ambient-blob-2 absolute top-1/4 -right-40 h-[700px] w-[700px] rounded-full bg-[#2874a6]/15 blur-[130px]" />
        <div className="ambient-blob-3 absolute -bottom-60 left-1/4 h-[700px] w-[700px] rounded-full bg-[#1b4f72]/12 blur-[130px]" />
        <div className="ambient-blob-2 absolute top-2/3 left-1/2 h-[500px] w-[500px] rounded-full bg-[#21618c]/10 blur-[120px]" />
      </div>
      {/* Logo — top left */}
      <div className="absolute top-6 left-6 z-10">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Veritas"
            width={40}
            height={40}
            className="hover:opacity-80 transition-all cursor-pointer"
            style={{ filter: "brightness(1.4)" }}
          />
        </Link>
      </div>

      {/* Sign out — top right */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{userName}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-white/60 hover:text-white"
        >
          Sign out
        </Button>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-20 pb-8 relative z-[1]">
        {/* Page header */}
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

        {/* Stats overview */}
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
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Studies list */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading studies...</p>
          ) : studies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No studies yet. Create your first study to get started.</p>
                <Link href="/dashboard/studies/new">
                  <Button>Create Study</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            studies.map((study) => (
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
                          <div className="font-semibold">
                            {study.enrollmentCount}
                          </div>
                          <div className="text-muted-foreground">Enrolled</div>
                        </div>
                        <Separator orientation="vertical" className="h-8" />
                        <div className="text-center">
                          <div className="font-semibold">
                            {study.completedCount}
                          </div>
                          <div className="text-muted-foreground">Completed</div>
                        </div>
                        <Separator orientation="vertical" className="h-8" />
                        <div className="text-center">
                          <div className="font-semibold text-destructive">
                            {study.flaggedCount}
                          </div>
                          <div className="text-muted-foreground">Flagged</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
