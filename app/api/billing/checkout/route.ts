export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  console.log("[Checkout] ROUTE HIT");
  try {
    console.log("\n🚀 ===== DÉBUT CHECKOUT STRIPE (/api/billing/checkout) =====");
    console.log("[Checkout] 1️⃣ Démarrage handler POST");

    console.log("[Checkout] 2️⃣ Vérification auth Clerk...");
    const { userId } = await auth();
    console.log("[Checkout]    userId:", userId);

    if (!userId) {
      console.error("[Checkout]    ❌ Utilisateur non authentifié");
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    console.log("[Checkout]    ✅ Auth OK");

    // Rate limiting checkouts Stripe : 3 par heure par utilisateur (PROD uniquement)
    const hasUpstashConfig =
      !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

    if (process.env.NODE_ENV === "production" && hasUpstashConfig) {
      try {
        const { success } = await checkoutLimiter.limit(userId);
        if (!success) {
          console.warn("[Checkout] Rate limit dépassé pour l'utilisateur", { userId });
          return NextResponse.json(
            { error: "Trop de tentatives. Réessayez dans 1 heure." },
            { status: 429 }
          );
        }
      } catch (e) {
        console.error(
          "[Checkout] Erreur lors de l'application du rate limit Upstash, checkout NON bloqué:",
          e
        );
      }
    } else {
      console.log("[Checkout] Rate limit complètement désactivé (dev ou Upstash non configuré)");
    }

    // Valider la configuration Stripe
    try {
      console.log("[Checkout] 3️⃣ Validation configuration Stripe (validateStripeConfig)...");
      validateStripeConfig();
    } catch (error) {
      console.error("[Checkout] Erreur configuration Stripe:", error);
      try {
        const stripeEnvKeys = Object.keys(process.env).filter((k) =>
          k.startsWith("STRIPE_PRICE_")
        );
        console.error("[Checkout] Variables STRIPE_PRICE_ disponibles:", stripeEnvKeys);
      } catch {
        // ne pas bloquer si process.env n'est pas sérialisable
      }
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

    console.log("[Checkout] 4️⃣ Initialisation client Stripe...");
    const stripe = getStripeOrNull();
    if (!stripe) {
      console.error("[Checkout] Stripe non configuré (getStripeOrNull a retourné null)");
      return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
    }

    console.log("[Checkout] 5️⃣ Lecture du corps de la requête...");
    const body = await req.json();
    const { type, plan, period, packIndex, billingMode } = body;

    console.log(
      "[Checkout]    Body reçu:",
      JSON.stringify({ type, plan, period, packIndex, billingMode }, null, 2)
    );

    console.log("[Checkout] 6️⃣ Infos clés Stripe (env)...");
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    console.log(
      "[Checkout]    STRIPE_SECRET_KEY:",
      secretKey
        ? `${secretKey.substring(0, 8)}... (${secretKey.startsWith("sk_live_") ? "LIVE" : "TEST"})`
        : "NON DÉFINIE"
    );
    console.log(
      "[Checkout]    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:",
      pubKey ? `${pubKey.substring(0, 12)}...` : "NON DÉFINIE"
    );

    if (type === "subscription") {
      // Achat d'un abonnement
      if (!plan || !period) {
        console.error("[Checkout] Paramètres manquants pour subscription", {
          plan,
          period,
        });
        return NextResponse.json(
          { error: "Plan et période requis" },
          { status: 400 }
        );
      }

      console.log("[Checkout] 7️⃣ Type subscription détecté", {
        plan,
        period,
        billingMode,
      });

      const mode: BillingMode =
        period === "yearly" && billingMode === "annual_commit_monthly"
          ? "annual_commit_monthly"
          : period === "yearly"
          ? "yearly_upfront"
          : "monthly";

      console.log("[Checkout] 8️⃣ Mode de facturation déterminé", { mode });

      const priceId =
        mode === "annual_commit_monthly"
          ? getStripePriceIdAnnualCommitMonthly(plan as PlanType)
          : getStripePriceId(plan as PlanType, period as BillingPeriod);

      console.log("[Checkout] 9️⃣ Price ID Stripe résolu pour subscription", {
        plan,
        period,
        mode,
        priceId,
      });

      if (!priceId) {
        console.error("[Checkout]    ❌ AUCUN priceId trouvé pour ce plan/période", {
          plan,
          period,
          mode,
        });
        return NextResponse.json(
          {
            error: "Configuration Stripe manquante pour ce plan/période",
            details: { plan, period, mode },
          },
          { status: 500 }
        );
      }

      // Récupérer ou créer l'utilisateur pour obtenir/create le Stripe Customer
      console.log("[Checkout] 🔟 Récupération/creation utilisateur (getOrCreateUserWithQuota)...");
      const user = await getOrCreateUserWithQuota(userId);

      let customerId = user.stripeCustomerId;

      if (!customerId) {
        console.log("[Checkout] 1️⃣1️⃣ Aucun Stripe customerId, création en cours…", {
          userId,
        });
        // Créer un Stripe Customer
        const customer = await stripe.customers.create({
          metadata: {
            clerkUserId: userId,
          },
        });
        customerId = customer.id;

        console.log("[Checkout]    ✅ Stripe Customer créé", { customerId });

        // Mettre à jour l'utilisateur avec le customer ID
        // (sera fait aussi dans le webhook, mais on le fait ici pour éviter les doublons)
      }

      console.log("[Checkout] 1️⃣2️⃣ Création de la session Stripe Checkout (subscription)…");

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
        allow_promotion_codes: true,
        metadata: {
          clerkUserId: userId,
          type: "subscription",
          plan,
          period,
          billingMode: mode,
          priceId,
        },
      });

      console.log("[Checkout]    ✅ Session Stripe créée (subscription)", {
        sessionId: session.id,
        url: session.url,
      });

      return NextResponse.json({ url: session.url });
    } else if (type === "pack") {
      // Achat d'un pack
      if (packIndex === undefined || packIndex === null) {
        console.error("[Checkout] Index de pack manquant pour type=pack", {
          packIndex,
        });
        return NextResponse.json(
          { error: "Index du pack requis" },
          { status: 400 }
        );
      }

      console.log("[Checkout] 7️⃣ Type pack détecté", { packIndex });

      const priceId = getStripePriceIdForPack(packIndex);

      console.log("[Checkout] 8️⃣ Price ID Stripe résolu pour pack", {
        packIndex,
        priceId,
      });

      if (!priceId) {
        console.error("[Checkout]    ❌ AUCUN priceId trouvé pour ce packIndex", {
          packIndex,
        });
        return NextResponse.json(
          {
            error: "Configuration Stripe manquante pour ce pack",
            details: { packIndex },
          },
          { status: 500 }
        );
      }

      console.log("[Checkout] 🔟 Récupération/creation utilisateur (getOrCreateUserWithQuota)...");
      const user = await getOrCreateUserWithQuota(userId);

      let customerId = user.stripeCustomerId;

      if (!customerId) {
        console.log("[Checkout] 1️⃣1️⃣ Aucun Stripe customerId, création en cours…", {
          userId,
        });
        const customer = await stripe.customers.create({
          metadata: {
            clerkUserId: userId,
          },
        });
        customerId = customer.id;

        console.log("[Checkout]    ✅ Stripe Customer créé", { customerId });
      }

      console.log("[Checkout] 1️⃣2️⃣ Création de la session Stripe Checkout (pack)…");

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
        allow_promotion_codes: true,
        metadata: {
          clerkUserId: userId,
          type: "pack",
          packIndex: String(packIndex),
        },
      });

      console.log("[Checkout]    ✅ Session Stripe créée (pack)", {
        sessionId: session.id,
        url: session.url,
      });

      return NextResponse.json({ url: session.url });
    } else {
      console.error("[Checkout] ❌ Type invalide reçu", { type });
      return NextResponse.json(
        { error: "Type invalide (subscription ou pack)" },
        { status: 400 }
      );
    }
  } catch (error) {
    const err = error as { message?: string; stack?: string; type?: string };
    console.log("\n❌ ===== ERREUR CHECKOUT STRIPE =====");
    console.error("[Checkout] ERREUR CRITIQUE dans /api/billing/checkout:", {
      message: err?.message,
      type: err?.type,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
    console.log("===== FIN ERREUR CHECKOUT =====\n");
    return NextResponse.json(
      {
        error: "Erreur lors de la création du checkout Stripe",
        message: err?.message ?? "Erreur inconnue",
        type: err?.type ?? null,
      },
      { status: 500 }
    );
  }
}
