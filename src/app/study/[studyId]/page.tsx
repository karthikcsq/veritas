"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock — replace with GET /api/studies/:studyId/public
const mockStudy = {
  title: "Pain Management in Adults Over 50",
  description:
    "A survey study examining pain management strategies and their effectiveness in adults aged 50 and older. Your responses will help improve clinical treatment recommendations.",
  compensationUsd: 25.0,
  questionCount: 8,
};

export default function StudyEnrollPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto h-10 w-10 rounded-lg bg-primary flex items-center justify-center mb-2">
            <span className="text-primary-foreground font-bold">V</span>
          </div>
          <CardTitle className="text-2xl">{mockStudy.title}</CardTitle>
          <CardDescription className="mt-2">
            {mockStudy.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Study info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">
                ${mockStudy.compensationUsd}
              </div>
              <div className="text-sm text-muted-foreground">Compensation</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">
                {mockStudy.questionCount}
              </div>
              <div className="text-sm text-muted-foreground">Questions</div>
            </div>
          </div>

          {/* Verification info */}
          <div className="rounded-lg border border-dashed p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">World ID Required</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              This study uses World ID to verify that each participant is a
              unique real person. Your identity remains completely anonymous — no
              personal information is stored.
            </p>
          </div>

          {/* CTA */}
          <Button size="lg" className="w-full">
            Verify with World ID to Enroll
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By enrolling, you agree to answer all questions honestly. Your
            responses will be evaluated for quality.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
