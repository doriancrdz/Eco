export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripeOrNull } from "@/lib/stripe";
import { getOrCreateUserWithQuota, updateUserPlan, creditExtraMinutes } from "@/lib/billing";
import { getCurrentMonthKey } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { PlanType } from "@/lib/billingConfig";

export async function POST(req: NextRequest) {
  const stripe = getStripeOrNull();
  if (!stripe) return new NextResponse("Stripe non configuré", { status: 503 });


  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Signature manquante" },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET manquant");
    return NextResponse.json(
      { error: "Configuration webhook manquante" },
      { status: 500 }
    );
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Erreur vérification signature webhook:", err);
    return NextResponse.json(
      { error: "Signature invalide" },
      { status: 400 }
    );
  }

  try {
    // Gérer les événements Stripe
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;

      const clerkUserId = session.metadata?.clerkUserId;
      if (!clerkUserId) {
        console.error("clerkUserId manquant dans metadata");
        return NextResponse.json({ received: true });
      }

      const user = await getOrCreateUserWithQuota(clerkUserId);

      if (session.metadata?.type === "subscription") {
        // Abonnement créé
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        await updateUserPlan(
          user.id,
          session.metadata.plan as PlanType,
          customerId,
          subscriptionId
        );

        // Logger la transaction
        await prisma.transaction.create({
          data: {
            userId: user.id,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: session.metadata.priceId || "",
            type: "subscription",
            minutesDelta: 0,
          },
        });
      } else if (session.metadata?.type === "pack") {
        // Pack acheté
        const packIndex = parseInt(session.metadata.packIndex || "0", 10);
        const customerId = session.customer as string;

        // Déterminer les minutes du pack (hardcodé pour l'instant, peut être amélioré)
        const packMinutes = [120, 600, 3000][packIndex] || 0;

        if (packMinutes > 0) {
          const currentMonthKey = getCurrentMonthKey();
          await creditExtraMinutes(user.id, packMinutes, currentMonthKey);

          // Logger la transaction
          await prisma.transaction.create({
            data: {
              userId: user.id,
              stripeCustomerId: customerId,
              stripePriceId: session.metadata.priceId || "",
              type: "pack",
              minutesDelta: packMinutes,
            },
          });
        }
      }
    } else if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as any;
      const customerId = subscription.customer as string;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user && subscription.status === "active") {
        // Mettre à jour le plan si nécessaire (basé sur le price_id)
        // Pour simplifier, on garde le plan actuel
        // Une version plus avancée pourrait mapper price_id -> plan
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as any;
      const customerId = subscription.customer as string;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        // Rétrograder vers Free
        await updateUserPlan(user.id, "free");
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erreur traitement webhook:", error);
    return NextResponse.json(
      { error: "Erreur traitement webhook" },
      { status: 500 }
    );
  }
}
