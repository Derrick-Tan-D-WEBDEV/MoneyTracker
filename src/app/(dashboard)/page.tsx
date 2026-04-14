import { getDashboardData } from "@/actions/dashboard";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  let data;
  try {
    data = await getDashboardData();
  } catch {
    data = null;
  }

  return <DashboardClient data={data} />;
}
