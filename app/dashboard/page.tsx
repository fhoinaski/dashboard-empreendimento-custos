// app/dashboard/page.tsx
import type { Metadata } from "next";
import DashboardOverview from "@/components/dashboard/dashboard-overview"; // This is the Client Component

export const metadata: Metadata = {
  title: "Dashboard | Scotta Empreendimentos",
  description: "Visão geral dos seus empreendimentos imobiliários",
};

// This is a Server Component. It should just render the Client Component.
// The Client Component (DashboardOverview) will handle its own data fetching.
export default function DashboardPage() {
  // No data fetching or prop passing needed here for DashboardOverview
  return <DashboardOverview />;
}