import { SessionProvider } from "next-auth/react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { TopNav } from "@/components/dashboard/top-nav";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <AppSidebar />
          <div className="md:pl-16">
            <TopNav />
            <main className="p-4 md:p-6 pb-24 md:pb-6">
              <DashboardShell>{children}</DashboardShell>
            </main>
          </div>
          <MobileBottomNav />
        </div>
      </TooltipProvider>
    </SessionProvider>
  );
}
