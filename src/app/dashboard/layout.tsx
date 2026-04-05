import { SessionProvider } from "@/components/session-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen">
        <main>{children}</main>
      </div>
    </SessionProvider>
  );
}
