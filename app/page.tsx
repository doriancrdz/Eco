import { auth } from "@clerk/nextjs/server";
import DashboardPage from "@/components/DashboardPage";
import LandingPage from "@/components/LandingPage";

export default async function Page() {
  const { userId } = await auth();

  if (userId) {
    return <DashboardPage />;
  }

  return <LandingPage />;
}
