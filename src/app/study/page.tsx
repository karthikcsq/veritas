"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PublicStudy {
  id: string;
  title: string;
  description: string;
  compensationUsd: number;
  targetCount: number;
  questionCount: number;
}

export default function BrowseStudiesPage() {
  const [studies, setStudies] = useState<PublicStudy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/studies/public");
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

  return (
    <div className="flex-1">
      <main className="max-w-4xl mx-auto w-full px-6 py-10">
        {/* Welcome */}
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold">Available Studies</h1>
          <p className="text-muted-foreground">
            Browse active research studies below. You&apos;ll verify your identity with World ID
            (no personal info stored) and earn compensation for quality responses.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">1. Choose a study</div>
            <div className="text-xs text-muted-foreground">Browse and pick a study that interests you</div>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">2. Verify with World ID</div>
            <div className="text-xs text-muted-foreground">Prove you&apos;re a unique person — no PII stored</div>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">3. Complete the survey</div>
            <div className="text-xs text-muted-foreground">Answer thoughtfully and earn compensation</div>
          </div>
        </div>

        {/* Studies */}
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-12">Loading studies...</p>
        ) : studies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No studies are currently accepting participants. Check back later.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {studies.map((study) => (
              <Link key={study.id} href={`/study/${study.id}`}>
                <Card className="h-full hover:border-foreground/20 transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg">{study.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {study.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">${study.compensationUsd}</Badge>
                      <Badge variant="outline">{study.questionCount} questions</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
