import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SignOutButton } from "@/components/sign-out-button";

// Mock data — replace with API calls
const mockStudies = [
  {
    id: "1",
    title: "Pain Management in Adults Over 50",
    status: "ACTIVE" as const,
    targetCount: 200,
    enrollmentCount: 47,
    completedCount: 31,
    flaggedCount: 3,
  },
  {
    id: "2",
    title: "Sleep Quality and Screen Time",
    status: "DRAFT" as const,
    targetCount: 150,
    enrollmentCount: 0,
    completedCount: 0,
    flaggedCount: 0,
  },
];

const statusColor = {
  DRAFT: "secondary",
  ACTIVE: "default",
  CLOSED: "outline",
} as const;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="border-b bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">V</span>
          </div>
          <span className="font-semibold text-lg">Veritas</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {session?.user?.name ?? "Researcher"}
          </span>
          <SignOutButton />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
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
            { label: "Total Studies", value: "2" },
            { label: "Active Enrollments", value: "47" },
            { label: "Completed", value: "31" },
            { label: "Flagged", value: "3" },
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
          {mockStudies.map((study) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}
