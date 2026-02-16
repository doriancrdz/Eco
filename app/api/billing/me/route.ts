import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateUserWithQuota, getAvailableMinutes } from "@/lib/billing";
import { PLANS } from "@/lib/billingConfig";
import { getStripeOrNull } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await getOrCreateUserWithQuota(userId);
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { commitmentEndAt: true, billingMode: true, stripeSubscriptionId: true, subscriptionStatus: true },
    });

    const subscriptionBlocked = Boolean(
      fullUser?.stripeSubscriptionId &&
      (fullUser.subscriptionStatus === "past_due" || fullUser.subscriptionStatus === "unpaid")
    );
    const planConfig = PLANS[user.plan];
    const availableMinutes = subscriptionBlocked
      ? 0
      : getAvailableMinutes(
          user.plan,
          user.minutesUsedMonth,
          user.extraMinutesMonth
        );
    const commitmentEndAt = fullUser?.commitmentEndAt?.toISOString() ?? null;
    const billingMode = fullUser?.billingMode ?? null;
    const now = new Date();
    const canCancel =
      !user.stripeSubscriptionId ||
      user.plan === "free" ||
      billingMode !== "annual_commit_monthly" ||
      (fullUser?.commitmentEndAt ? now >= fullUser.commitmentEndAt : true);

    // Récupérer current_period_end depuis Stripe si l'utilisateur a une subscription
    let quotaResetAt: string | null = null;
    if (user.stripeSubscriptionId && user.plan !== "free") {
      const stripe = getStripeOrNull();
      if (stripe) {
        try {
          const subscription = await stripe.subscriptions.retrieve(
            user.stripeSubscriptionId
          );
          if (subscription.current_period_end) {
            quotaResetAt = new Date(
              subscription.current_period_end * 1000
            ).toISOString();
          }
        } catch (err) {
          console.error("Erreur récupération subscription Stripe:", err);
          // Continue sans quotaResetAt si erreur
        }
      }
    }

    return NextResponse.json({
      plan: user.plan,
      planName: planConfig.name,
      minutesPerMonth: planConfig.minutesPerMonth,
      minutesUsedMonth: user.minutesUsedMonth,
      extraMinutesMonth: user.extraMinutesMonth,
      availableMinutes,
      monthKey: user.monthKey,
      quotaResetAt,
      commitmentEndAt,
      canCancel,
      subscriptionStatus: fullUser?.subscriptionStatus ?? null,
      paymentBlocked: subscriptionBlocked ?? false,
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
