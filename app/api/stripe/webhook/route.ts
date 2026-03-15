export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripeOrNull } from "@/lib/stripe";
import { getOrCreateUserWithQuota, updateUserPlan, creditExtraMinutes } from "@/lib/billing";
import { getOrCreateUserWithQuotaSeconds, updateUserQuotaTotal, creditExtraSeconds, creditBonusSeconds } from "@/lib/usage";
import { getCurrentMonthKey } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { PlanType, isAnnualCommitMonthlyPriceId, resolvePlanFromPriceId, PACKS } from "@/lib/billingConfig";

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
    if (process.env.NODE_ENV === "development") {
      console.error("STRIPE_WEBHOOK_SECRET manquant");
    }
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
    console.error("[webhook] Signature invalide:", err);
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
        console.error("[webhook] clerkUserId manquant dans metadata, sessionId:", session.id);
        return NextResponse.json({ received: true });
      }

      // Idempotence : ignorer si cet événement a déjà été traité
      const alreadyProcessed = await prisma.transaction.findUnique({
        where: { stripeSessionId: session.id },
      });
      if (alreadyProcessed) {
        return NextResponse.json({ received: true });
      }

      const user = await getOrCreateUserWithQuota(clerkUserId);

      if (session.metadata?.type === "subscription") {
        // Abonnement créé
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;
        const priceId = session.metadata.priceId as string | undefined;
        const billingMode = (session.metadata.billingMode as string) || "monthly";

        let commitmentEndAt: Date | null = null;
        let currentPeriodEnd: Date | null = null;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const periodStart = subscription.current_period_start;
          if (subscription.current_period_end) {
            currentPeriodEnd = new Date(subscription.current_period_end * 1000);
          }
          if (billingMode === "annual_commit_monthly" && periodStart) {
            const end = new Date(periodStart * 1000);
            end.setUTCMonth(end.getUTCMonth() + 12);
            commitmentEndAt = end;
          }
        }

        await updateUserPlan(
          user.id,
          session.metadata.plan as PlanType,
          customerId,
          subscriptionId,
          {
            stripePriceId: priceId || null,
            billingMode: billingMode as "monthly" | "yearly_upfront" | "annual_commit_monthly",
            commitmentEndAt,
            subscriptionStatus: "active",
            currentPeriodEnd,
          }
        );

        // Mettre à jour le quota en secondes
        await updateUserQuotaTotal(user.id, session.metadata.plan as PlanType);

        // Logger la transaction
        await prisma.transaction.create({
          data: {
            userId: user.id,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId || "",
            stripeSessionId: session.id,
            type: "subscription",
            minutesDelta: 0,
          },
        });
      } else if (session.metadata?.type === "pack") {
        // Pack acheté
        const packIndex = parseInt(session.metadata.packIndex || "0", 10);
        const customerId = session.customer as string;

        // Déterminer les minutes du pack depuis la configuration
        const pack = PACKS[packIndex];
        const packMinutes = pack ? pack.minutes : 0;

        if (packMinutes > 0) {
          const packSeconds = packMinutes * 60;
          // Créditer les bonus permanents (jamais reset)
          await creditBonusSeconds(user.id, packSeconds);
          // Legacy: aussi créditer en minutes (deprecated)
          const currentMonthKey = getCurrentMonthKey();
          await creditExtraMinutes(user.id, packMinutes, currentMonthKey);

          // Logger la transaction
          await prisma.transaction.create({
            data: {
              userId: user.id,
              stripeCustomerId: customerId,
              stripePriceId: session.metadata.priceId || "",
              stripeSessionId: session.id,
              type: "pack",
              minutesDelta: packMinutes,
            },
          });
        } else {
          // PackIndex invalide → retourner 500 pour que Stripe rejoue l'event
          console.error(
            `[webhook] Pack invalide: packIndex=${packIndex}, sessionId=${session.id}, customerId=${customerId}`
          );
          return NextResponse.json({ error: "Pack invalide" }, { status: 500 });
        }
      }
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as { subscription?: string; customer?: string };
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      if (!subscriptionId) return NextResponse.json({ received: true });

      const user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionStatus: "past_due" },
        });
      }
    } else if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as { subscription?: string; customer?: string };
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      if (!subscriptionId) return NextResponse.json({ received: true });

      const user = await prisma.user.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });
      if (user) {
        // Récupérer la subscription pour mettre à jour currentPeriodEnd
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const periodEnd = subscription.current_period_end;
          const now = new Date();

          // Renouvellement : l'ancienne currentPeriodEnd est dépassée → reset quota
          const isRenewal = user.currentPeriodEnd != null && now >= user.currentPeriodEnd;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: "active",
              currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
              ...(isRenewal && {
                quotaSecondsUsed: 0,
                quotaExtraSeconds: 0,
                minutesUsedMonth: 0,
                extraMinutesMonth: 0,
                monthKey: getCurrentMonthKey(),
              }),
            },
          });
        } catch (error) {
          console.error("[webhook] Erreur récupération subscription dans invoice.payment_succeeded:", error);
          // Fallback: mettre à jour seulement le status
          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: "active" },
          });
        }
      }
    } else if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as any;
      const customerId = subscription.customer as string;
      const subscriptionId = subscription.id as string;
      const status = subscription.status as string;
      const periodEnd = subscription.current_period_end as number | undefined;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
        const periodStart = subscription.current_period_start;
        const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
        const billingMode = priceId && isAnnualCommitMonthlyPriceId(priceId)
          ? "annual_commit_monthly"
          : interval === "year"
          ? "yearly_upfront"
          : "monthly";
        let commitmentEndAt: Date | null = null;
        if (priceId && isAnnualCommitMonthlyPriceId(priceId) && periodStart) {
          const end = new Date(periodStart * 1000);
          end.setUTCMonth(end.getUTCMonth() + 12);
          commitmentEndAt = end;
        }

        // Mettre à jour le plan si le priceId a changé (upgrade/downgrade Stripe)
        const resolvedPlan = priceId ? resolvePlanFromPriceId(priceId) : null;
        if (resolvedPlan && resolvedPlan !== user.plan) {
          await updateUserPlan(user.id, resolvedPlan, undefined, subscriptionId, {
            stripePriceId: priceId,
            billingMode,
            ...(commitmentEndAt && { commitmentEndAt }),
            subscriptionStatus: status,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
          });
          await updateUserQuotaTotal(user.id, resolvedPlan);
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: subscriptionId,
              ...(priceId && { stripePriceId: priceId }),
              billingMode,
              ...(commitmentEndAt && { commitmentEndAt }),
              subscriptionStatus: status,
              currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            },
          });
        }
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as any;
      const customerId = subscription.customer as string;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        await updateUserPlan(user.id, "free", undefined, null, {
          stripeSubscriptionId: null,
          stripePriceId: null,
          billingMode: null,
          commitmentEndAt: null,
          subscriptionStatus: null,
          currentPeriodEnd: null,
        });
        // Mettre à jour le quota en secondes pour le plan free
        await updateUserQuotaTotal(user.id, "free");
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook] Erreur traitement webhook:", error);
    return NextResponse.json(
      { error: "Erreur traitement webhook" },
      { status: 500 }
    );
  }
}
