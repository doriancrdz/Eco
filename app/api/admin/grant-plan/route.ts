import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { updateUserPlan } from "@/lib/billing";
import type { PlanType } from "@/lib/billingConfig";

const ADMIN_EMAIL = "cdorian654@yahoo.com";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userId: adminClerkUserId } = await auth();

    if (!adminClerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(adminClerkUserId);

    if (clerkUser.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId, plan } = await request.json();

    console.log("[Grant Plan] Reçu:", { userId, plan });

    const allowedPlans: PlanType[] = ["student", "pro", "business"];

    if (!userId || !plan) {
      console.log("[Grant Plan] ❌ Paramètres manquants", {
        hasUserId: !!userId,
        hasPlan: !!plan,
      });
      return NextResponse.json(
        {
          error: "Paramètres manquants",
          details: { hasUserId: !!userId, hasPlan: !!plan },
        },
        { status: 400 }
      );
    }

    if (!allowedPlans.includes(plan)) {
      console.log("[Grant Plan] ❌ Plan invalide:", plan);
      return NextResponse.json(
        { error: "Plan invalide", details: { plan, allowedPlans } },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!existingUser) {
      console.log("[Grant Plan] ❌ Utilisateur non trouvé:", userId);
      return NextResponse.json(
        { error: "Utilisateur non trouvé", userId },
        { status: 404 }
      );
    }

    await updateUserPlan(existingUser.id, plan as PlanType, undefined, null, {
      billingMode: null,
      commitmentEndAt: null,
      subscriptionStatus: null,
      currentPeriodEnd: new Date("2030-12-31T23:59:59.999Z"),
      stripePriceId: null,
      stripeSubscriptionId: null,
    });

    const updated = await prisma.user.findUnique({
      where: { id: existingUser.id },
      select: {
        id: true,
        plan: true,
        quotaSecondsTotal: true,
        quotaSecondsUsed: true,
        bonusSeconds: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Utilisateur introuvable après mise à jour" },
        { status: 500 }
      );
    }

    const minutesIncluded = Math.floor(updated.quotaSecondsTotal / 60);
    const minutesUsed = Math.ceil(updated.quotaSecondsUsed / 60);
    const bonusMinutes = Math.ceil(updated.bonusSeconds / 60);

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        plan: updated.plan,
        minutesIncluded,
        minutesUsed,
        bonusMinutes,
        currentPeriodEnd: updated.currentPeriodEnd
          ? updated.currentPeriodEnd.toISOString()
          : null,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[admin/grant-plan] Error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

