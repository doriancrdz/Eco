import type { Metadata } from "next";
import DashboardPage from "@/components/DashboardPage";

export const metadata: Metadata = {
  title: "ECO",
  robots: { index: false, follow: false },
};

export default function AppPage() {
  return <DashboardPage />;
}
