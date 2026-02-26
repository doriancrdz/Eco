import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateUserWithQuotaSeconds, getAvailableSeconds, formatSecondsToMMSS } from "@/lib/usage";
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

    const user = await getOrCreateUserWithQuotaSeconds(userId);
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { commitmentEndAt: true, billingMode: true, stripeSubscriptionId: true, subscriptionStatus: true, bonusSeconds: true },
    });

    // Déterminer le type d'abonnement depuis Stripe
    let subscriptionType: "monthly" | "annual" | null = null;
    if (fullUser?.stripeSubscriptionId) {
      try {
        const stripe = getStripeOrNull();
        if (stripe) {
          const subscription = await stripe.subscriptions.retrieve(fullUser.stripeSubscriptionId);
          const interval = subscription.items.data[0]?.price?.recurring?.interval;
          if (interval === "month") {
            subscriptionType = "monthly";
          } else if (interval === "year") {
            subscriptionType = "annual";
          }
        }
      } catch (error) {
        console.error("[billing/me] Erreur récupération subscription Stripe:", error);
        // Fallback: utiliser billingMode si disponible
        if (fullUser?.billingMode === "monthly") {
          subscriptionType = "monthly";
        } else if (fullUser?.billingMode === "yearly_upfront" || fullUser?.billingMode === "annual_commit_monthly") {
          subscriptionType = "annual";
        }
      }
    }

    const subscriptionBlocked = Boolean(
      fullUser?.stripeSubscriptionId &&
      (fullUser.subscriptionStatus === "past_due" || fullUser.subscriptionStatus === "unpaid")
    );
    const planConfig = PLANS[user.plan];
    
    // Calculer les secondes disponibles
    const availableSeconds = subscriptionBlocked
      ? 0
      : getAvailableSeconds(
          user.quotaSecondsTotal,
          user.quotaSecondsUsed,
          user.quotaExtraSeconds,
          user.bonusSeconds
        );
    
    // Convertir en minutes pour compatibilité (arrondi vers le bas)
    const availableMinutes = Math.floor(availableSeconds / 60);
    
    const commitmentEndAt = fullUser?.commitmentEndAt?.toISOString() ?? null;
    const billingMode = fullUser?.billingMode ?? null;
    const now = new Date();
    const canCancel =
      !user.stripeSubscriptionId ||
      user.plan === "free" ||
      billingMode !== "annual_commit_monthly" ||
      (fullUser?.commitmentEndAt ? now >= fullUser.commitmentEndAt : true);

    const isCommit = Boolean(
      billingMode === "annual_commit_monthly" ||
        (fullUser?.commitmentEndAt && now < fullUser.commitmentEndAt)
    );

    // Utiliser currentPeriodEnd depuis la DB (mis à jour par webhook Stripe)
    const quotaResetAt = user.currentPeriodEnd?.toISOString() ?? null;

    return NextResponse.json({
      plan: user.plan,
      planName: planConfig.name,
      minutesPerMonth: planConfig.minutesPerMonth,
      // Legacy fields (deprecated, gardés pour compatibilité)
      minutesUsedMonth: Math.ceil(user.quotaSecondsUsed / 60),
      extraMinutesMonth: Math.ceil(user.quotaExtraSeconds / 60),
      availableMinutes, // Arrondi vers le bas pour compatibilité
      // Nouveaux champs en secondes (source de vérité)
      quotaSecondsTotal: user.quotaSecondsTotal,
      quotaSecondsUsed: user.quotaSecondsUsed,
      quotaExtraSeconds: user.quotaExtraSeconds,
      bonusSeconds: user.bonusSeconds,
      availableSeconds,
      availableSecondsFormatted: formatSecondsToMMSS(availableSeconds),
      monthKey: user.monthKey,
      quotaResetAt,
      commitmentEndAt,
      canCancel,
      subscriptionStatus: fullUser?.subscriptionStatus ?? null,
      subscriptionType, // "monthly" | "annual" | null
      stripeSubscriptionId: fullUser?.stripeSubscriptionId ?? null,
      isCommit,
      paymentBlocked: subscriptionBlocked ?? false,
    });
  } catch (error) {
    const err = error as { message?: string; stack?: string };
    console.error("[billing/me] Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
