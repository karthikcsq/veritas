import Link from "next/link";
import Image from "next/image";

export default function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <nav className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <Link href="/study" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Veritas" width={28} height={28} style={{ filter: "brightness(1.4)" }} />
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
