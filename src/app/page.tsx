import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">V</span>
          </div>
          <span className="font-semibold text-lg">Veritas</span>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-3xl w-full space-y-8 text-center">
          <div className="space-y-3">
            <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
              World ID + AI Quality Scoring
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Verified clinical research data.
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Proof-of-personhood verification and AI-powered quality scoring
              for clinical trial surveys.
            </p>
          </div>

          {/* Two paths */}
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto pt-4">
            <Link href="/auth/login" className="block">
              <Card className="h-full hover:border-foreground/20 transition-colors cursor-pointer text-left">
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-1">
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                  </div>
                  <CardTitle>I&apos;m a Researcher</CardTitle>
                  <CardDescription>
                    Create studies, design surveys, and analyze verified participant data with AI quality scoring.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    Researcher Login
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/study" className="block">
              <Card className="h-full hover:border-foreground/20 transition-colors cursor-pointer text-left">
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-1">
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </div>
                  <CardTitle>I&apos;m a Participant</CardTitle>
                  <CardDescription>
                    Browse active studies, verify your identity with World ID, and earn compensation for quality responses.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Browse Studies
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 pt-8 max-w-lg mx-auto">
            <div>
              <div className="text-2xl font-bold">100%</div>
              <div className="text-xs text-muted-foreground">Unique participants</div>
            </div>
            <div>
              <div className="text-2xl font-bold">Real-time</div>
              <div className="text-xs text-muted-foreground">Quality scoring</div>
            </div>
            <div>
              <div className="text-2xl font-bold">Zero</div>
              <div className="text-xs text-muted-foreground">PII stored</div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        Veritas — Built for the World ID Hackathon
      </footer>
    </div>
  );
}
