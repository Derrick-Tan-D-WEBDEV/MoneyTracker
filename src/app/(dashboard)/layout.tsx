import { SessionProvider } from "next-auth/react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { TopNav } from "@/components/dashboard/top-nav";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PartnerViewProvider } from "@/hooks/use-partner-view";
import { getPartnerViewState } from "@/lib/partner-view";
import { getCoupleLink } from "@/actions/couple";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let partnerViewState: { isPartnerView: boolean; partnerName: string | null; partnerImage?: string | null; partnerCurrency?: string | null; partnerId: string | null } = {
    isPartnerView: false,
    partnerName: null,
    partnerId: null,
  };
  let coupleLink: Awaited<ReturnType<typeof getCoupleLink>> = null;

  try {
    [partnerViewState, coupleLink] = await Promise.all([getPartnerViewState(), getCoupleLink()]);
  } catch {
    // Not authenticated yet
  }

  const linkedPartner = coupleLink?.status === "ACCEPTED" && coupleLink.partner ? { id: coupleLink.partner.id, name: coupleLink.partner.name, image: coupleLink.partner.image } : null;

  return (
    <SessionProvider>
      <PartnerViewProvider initialState={partnerViewState}>
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            <AppSidebar />
            <div className="md:pl-16">
              <TopNav linkedPartner={linkedPartner} />
              <main className="p-4 md:p-6 pb-36 md:pb-24">
                <DashboardShell>{children}</DashboardShell>
              </main>
            </div>
            <MobileBottomNav />
          </div>
        </TooltipProvider>
      </PartnerViewProvider>
    </SessionProvider>
  );
}
