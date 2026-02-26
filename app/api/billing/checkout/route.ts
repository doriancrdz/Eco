export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStripeOrNull } from "@/lib/stripe";
import {
  getStripePriceId,
  getStripePriceIdAnnualCommitMonthly,
  getStripePriceIdForPack,
  validateStripeConfig,
  PlanType,
  BillingPeriod,
  BillingMode,
} from "@/lib/billingConfig";
import { getOrCreateUserWithQuota } from "@/lib/billing";
import { checkoutLimiter } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Rate limiting checkouts Stripe : 3 par heure par utilisateur
    const { success } = await checkoutLimiter.limit(userId);
    if (!success) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans 1 heure." },
        { status: 429 }
      );
    }

    // Valider la configuration Stripe
    try {
      validateStripeConfig();


    } catch (error) {
      console.error("Erreur configuration Stripe:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Configuration Stripe incomplète. Contactez le support.",
        },
        { status: 500 }
      );
    }

    const stripe = getStripeOrNull();
    if (!stripe) return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });

    const body = await req.json();
    const { type, plan, period, packIndex, billingMode } = body;

    if (type === "subscription") {
      // Achat d'un abonnement
      if (!plan || !period) {
        return NextResponse.json(
          { error: "Plan et période requis" },
          { status: 400 }
        );
      }

      const mode: BillingMode =
        period === "yearly" && billingMode === "annual_commit_monthly"
          ? "annual_commit_monthly"
          : period === "yearly"
          ? "yearly_upfront"
          : "monthly";

      const priceId =
        mode === "annual_commit_monthly"
          ? getStripePriceIdAnnualCommitMonthly(plan as PlanType)
          : getStripePriceId(plan as PlanType, period as BillingPeriod);

      // Récupérer ou créer l'utilisateur pour obtenir/create le Stripe Customer
      const user = await getOrCreateUserWithQuota(userId);

      let customerId = user.stripeCustomerId;

      if (!customerId) {
        // Créer un Stripe Customer
        const customer = await stripe.customers.create({
          metadata: {
            clerkUserId: userId,
          },
        });
        customerId = customer.id;

        // Mettre à jour l'utilisateur avec le customer ID
        // (sera fait aussi dans le webhook, mais on le fait ici pour éviter les doublons)
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${req.nextUrl.origin}/settings?success=true`,
        cancel_url: `${req.nextUrl.origin}/pricing?canceled=true`,
        metadata: {
          clerkUserId: userId,
          type: "subscription",
          plan,
          period,
          billingMode: mode,
          priceId,
        },
      });

      return NextResponse.json({ url: session.url });
    } else if (type === "pack") {
      // Achat d'un pack
      if (packIndex === undefined || packIndex === null) {
        return NextResponse.json(
          { error: "Index du pack requis" },
          { status: 400 }
        );
      }

      const priceId = getStripePriceIdForPack(packIndex);

      const user = await getOrCreateUserWithQuota(userId);

      let customerId = user.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          metadata: {
            clerkUserId: userId,
          },
        });
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${req.nextUrl.origin}/settings?success=true&type=pack`,
        cancel_url: `${req.nextUrl.origin}/settings?canceled=true`,
        metadata: {
          clerkUserId: userId,
          type: "pack",
          packIndex: String(packIndex),
        },
      });

      return NextResponse.json({ url: session.url });
    } else {
      return NextResponse.json(
        { error: "Type invalide (subscription ou pack)" },
        { status: 400 }
      );
    }
  } catch (error) {
    const err = error as { message?: string; stack?: string };
    console.error("[billing/checkout] Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
