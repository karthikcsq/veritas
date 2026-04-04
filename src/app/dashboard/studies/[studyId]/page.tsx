"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data — replace with API calls
const mockEnrollments = [
  { id: "e1", status: "COMPLETED", enrolledAt: "2024-01-15T10:30:00Z", avgScore: 0.91, flagged: false },
  { id: "e2", status: "COMPLETED", enrolledAt: "2024-01-15T11:15:00Z", avgScore: 0.84, flagged: false },
  { id: "e3", status: "FLAGGED", enrolledAt: "2024-01-15T12:00:00Z", avgScore: 0.32, flagged: true },
  { id: "e4", status: "IN_PROGRESS", enrolledAt: "2024-01-15T14:00:00Z", avgScore: null, flagged: false },
  { id: "e5", status: "COMPLETED", enrolledAt: "2024-01-16T09:00:00Z", avgScore: 0.77, flagged: false },
];

function scoreColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 0.7) return "text-green-600";
  if (score >= 0.45) return "text-yellow-600";
  return "text-destructive";
}

export default function StudyDetailPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="border-b bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              &larr; Back
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">Pain Management in Adults Over 50</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge>ACTIVE</Badge>
              <span className="text-sm text-muted-foreground">
                47 / 200 enrolled
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Close Study
          </Button>
          <Button size="sm">Share Link</Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats cards */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: "Enrolled", value: "47" },
            { label: "Completed", value: "31" },
            { label: "In Progress", value: "12" },
            { label: "Flagged", value: "4" },
            { label: "Avg Quality", value: "0.79" },
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

        {/* Tabs */}
        <Tabs defaultValue="enrollments">
          <TabsList>
            <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="enrollments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Participant Enrollments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {/* Table header */}
                  <div className="grid grid-cols-5 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
                    <div>ID</div>
                    <div>Status</div>
                    <div>Enrolled</div>
                    <div>Quality Score</div>
                    <div>Actions</div>
                  </div>
                  {/* Table rows */}
                  {mockEnrollments.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      className="grid grid-cols-5 gap-4 px-4 py-3 rounded-md hover:bg-muted/50 text-sm items-center"
                    >
                      <div className="font-mono text-xs">
                        {enrollment.id}
                      </div>
                      <div>
                        <Badge
                          variant={
                            enrollment.status === "FLAGGED"
                              ? "destructive"
                              : enrollment.status === "COMPLETED"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {enrollment.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(enrollment.enrolledAt).toLocaleDateString()}
                      </div>
                      <div className={scoreColor(enrollment.avgScore)}>
                        {enrollment.avgScore !== null
                          ? enrollment.avgScore.toFixed(2)
                          : "Pending"}
                      </div>
                      <div>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Study Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { order: 1, type: "SCALE", prompt: "On a scale of 1-10, how would you rate your average daily pain level?" },
                  { order: 2, type: "LONG_TEXT", prompt: "Describe how your pain affects your daily activities." },
                  { order: 3, type: "MULTIPLE_CHOICE", prompt: "Which pain management methods have you tried?" },
                  { order: 4, type: "LONG_TEXT", prompt: "Describe your experience with prescription pain medication." },
                ].map((q) => (
                  <div key={q.order} className="flex items-start gap-4 p-4 rounded-lg border">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                      {q.order}
                    </div>
                    <div>
                      <div className="font-medium">{q.prompt}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Type: {q.type.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Quality Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Recharts visualizations will go here — quality distribution,
                  score over time, flagged vs clean comparison
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
