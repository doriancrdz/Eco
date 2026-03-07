/**
 * Met à jour les descriptions des produits Stripe pour afficher les bonnes minutes (800, 2000, 6000).
 * À exécuter une fois : npx tsx scripts/update-stripe-descriptions.ts
 *
 * Les descriptions du checkout Stripe viennent des Produits liés aux Prices.
 * Ce script met à jour ces Produits via l'API Stripe.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Charger .env.local
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
import {
  PLANS,
  PACKS,
  getStripePriceId,
  getStripePriceIdAnnualCommitMonthly,
  getStripePriceIdForPack,
  PlanType,
  BillingPeriod,
} from "../lib/billingConfig";
import { getStripeOrNull } from "../lib/stripe";

const PAID_PLANS: PlanType[] = ["student", "pro", "business"];
const BILLING_PERIODS: BillingPeriod[] = ["monthly", "yearly"];

async function main() {
  let stripe;
  try {
    stripe = getStripeOrNull();
  } catch {
    console.error("❌ STRIPE_SECRET_KEY manquant dans .env.local");
    process.exit(1);
  }
  const updated = new Set<string>();

  console.log("🔧 Mise à jour des descriptions Stripe (800, 2000, 6000 min)...\n");

  // Plans (subscriptions)
  for (const plan of PAID_PLANS) {
    const description = `${PLANS[plan].minutesPerMonth} minutes par mois`;

    const priceIds: string[] = [];
    for (const period of BILLING_PERIODS) {
      try {
        priceIds.push(getStripePriceId(plan, period));
      } catch {
        // env non configuré
      }
    }
    try {
      priceIds.push(getStripePriceIdAnnualCommitMonthly(plan));
    } catch {
      // env non configuré
    }

    for (const priceId of priceIds) {
      if (updated.has(priceId)) continue;
      try {
        const price = await stripe.prices.retrieve(priceId);
        const productId = typeof price.product === "string" ? price.product : price.product.id;
        await stripe.products.update(productId, { description });
        updated.add(priceId);
        console.log(`  ✅ ${plan} (${priceId}): "${description}"`);
      } catch (err) {
        console.error(`  ❌ ${plan} (${priceId}):`, (err as Error).message);
      }
    }
  }

  // Packs
  const packLabels: Record<number, string> = { 0: "étudiant", 1: "pro", 2: "business" };
  for (let i = 0; i < PACKS.length; i++) {
    const pack = PACKS[i];
    const description = `${pack.minutes} minutes (pack ${packLabels[i] ?? ""})`;

    try {
      const priceId = getStripePriceIdForPack(i);
      if (updated.has(priceId)) continue;
      const price = await stripe.prices.retrieve(priceId);
      const productId = typeof price.product === "string" ? price.product : price.product.id;
      await stripe.products.update(productId, { description });
      updated.add(priceId);
      console.log(`  ✅ Pack ${pack.name} (${priceId}): "${description}"`);
    } catch (err) {
      console.error(`  ❌ Pack ${pack.name}:`, (err as Error).message);
    }
  }

  console.log(`\n✅ Terminé. ${updated.size} produit(s) mis à jour.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
