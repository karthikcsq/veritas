import { SessionProvider } from "@/components/session-provider";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen">
        <DashboardSidebar />
        <main className="md:ml-64">{children}</main>
      </div>
    </SessionProvider>
  );
}
