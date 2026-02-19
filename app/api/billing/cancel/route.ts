export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStripeOrNull } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        plan: true,
        stripeSubscriptionId: true,
        billingMode: true,
        commitmentEndAt: true,
      },
    });

    if (!user || !user.stripeSubscriptionId || user.plan === "free") {
      return NextResponse.json(
        { error: "Aucun abonnement actif à annuler" },
        { status: 400 }
      );
    }

    if (user.billingMode === "annual_commit_monthly" && user.commitmentEndAt) {
      const now = new Date();
      if (now < user.commitmentEndAt) {
        return NextResponse.json(
          {
            error: `Annulation possible à partir du ${user.commitmentEndAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} (engagement 12 mois).`,
          },
          { status: 403 }
        );
      }
    }

    const stripe = getStripeOrNull();
    if (!stripe) {
      return NextResponse.json(
        { error: "Paiement non configuré" },
        { status: 503 }
      );
    }

    // Annuler l'abonnement Stripe avec cancel_at_period_end = true
    // L'utilisateur garde l'accès jusqu'à la fin de la période payée
    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );

    console.log("[cancel] Abonnement résilié:", {
      userId,
      subscriptionId: user.stripeSubscriptionId,
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
    });

    return NextResponse.json({
      success: true,
      message: "Abonnement résilié. Vous garderez l'accès jusqu'à la fin de la période en cours.",
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
    });
  } catch (error) {
    console.error("Erreur annulation abonnement:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'annulation de l'abonnement",
      },
      { status: 500 }
    );
  }
}
