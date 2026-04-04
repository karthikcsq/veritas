import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        <div className="flex items-center gap-3">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/auth/register">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
            Powered by World ID + ML Scoring
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
            Trust your research data.
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Veritas combines cryptographic proof-of-personhood with AI-powered
            response quality scoring to eliminate fraud and low-effort responses
            from clinical research.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/auth/register">
              <Button size="lg">Start a Study</Button>
            </Link>
            <Link href="/study/demo">
              <Button variant="outline" size="lg">
                View Demo
              </Button>
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-8 pt-12 max-w-lg mx-auto">
            <div>
              <div className="text-3xl font-bold">100%</div>
              <div className="text-sm text-muted-foreground">
                Unique participants
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold">Real-time</div>
              <div className="text-sm text-muted-foreground">
                Quality scoring
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold">Zero</div>
              <div className="text-sm text-muted-foreground">PII stored</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        Veritas — Built for the World ID Hackathon
      </footer>
    </div>
  );
}
