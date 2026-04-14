import { getPartnerDashboardData, getCoupleLink } from "@/actions/couple";
import { PartnerDashboardClient } from "./partner-client";

export default async function PartnerPage() {
  const [coupleLink, partnerData] = await Promise.all([
    getCoupleLink(),
    getPartnerDashboardData(),
  ]);

  return <PartnerDashboardClient coupleLink={coupleLink} partnerData={partnerData} />;
}
