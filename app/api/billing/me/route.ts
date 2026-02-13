import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateUserWithQuota, getAvailableMinutes } from "@/lib/billing";
import { PLANS } from "@/lib/billingConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await getOrCreateUserWithQuota(userId);
    const planConfig = PLANS[user.plan];
    const availableMinutes = getAvailableMinutes(
      user.plan,
      user.minutesUsedMonth,
      user.extraMinutesMonth
    );

    return NextResponse.json({
      plan: user.plan,
      planName: planConfig.name,
      minutesPerMonth: planConfig.minutesPerMonth,
      minutesUsedMonth: user.minutesUsedMonth,
      extraMinutesMonth: user.extraMinutesMonth,
      availableMinutes,
      monthKey: user.monthKey,
    });
  } catch (error) {
    console.error("Erreur récupération quotas:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la récupération des quotas",
      },
      { status: 500 }
    );
  }
}
