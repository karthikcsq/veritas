import Link from "next/link";

export default function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <nav className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <Link href="/study" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">V</span>
          </div>
          <span className="font-semibold">Veritas</span>
        </Link>
        <Link
          href="/study"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Browse Studies
        </Link>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
