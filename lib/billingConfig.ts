/**
 * Configuration Stripe - PRICE_ID à remplir dans .env.local
 * 
 * IMPORTANT : Créez d'abord les produits/prices dans Stripe Dashboard,
 * puis ajoutez les PRICE_ID correspondants dans .env.local.
 * 
 * Format attendu dans .env.local :
 * STRIPE_PRICE_FREE_MONTHLY=price_xxx
 * STRIPE_PRICE_STUDENT_MONTHLY=price_xxx
 * STRIPE_PRICE_STUDENT_YEARLY=price_xxx
 * STRIPE_PRICE_PRO_MONTHLY=price_xxx
 * STRIPE_PRICE_PRO_YEARLY=price_xxx
 * STRIPE_PRICE_BUSINESS_MONTHLY=price_xxx
 * STRIPE_PRICE_BUSINESS_YEARLY=price_xxx
 * STRIPE_PRICE_PACK_120=price_xxx
 * STRIPE_PRICE_PACK_600=price_xxx
 * STRIPE_PRICE_PACK_3000=price_xxx
 */

export type PlanType = "free" | "student" | "pro" | "business";
export type BillingPeriod = "monthly" | "yearly";

export interface PlanConfig {
  name: string;
  minutesPerMonth: number;
  priceMonthly: number; // en euros
  priceYearly: number; // en euros
  yearlyDiscountPercent: number; // ~17%
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    name: "Free",
    minutesPerMonth: 10,
    priceMonthly: 0,
    priceYearly: 0,
    yearlyDiscountPercent: 0,
  },
  student: {
    name: "Student",
    minutesPerMonth: 120,
    priceMonthly: 19,
    priceYearly: 190,
    yearlyDiscountPercent: 17,
  },
  pro: {
    name: "Pro",
    minutesPerMonth: 600,
    priceMonthly: 49,
    priceYearly: 490,
    yearlyDiscountPercent: 17,
  },
  business: {
    name: "Business",
    minutesPerMonth: 3000,
    priceMonthly: 149,
    priceYearly: 1490,
    yearlyDiscountPercent: 17,
  },
};

export interface PackConfig {
  name: string;
  minutes: number;
  price: number; // en euros
}

export const PACKS: PackConfig[] = [
  { name: "Pack +120 min", minutes: 120, price: 15 },
  { name: "Pack +600 min", minutes: 600, price: 49 },
  { name: "Pack +3000 min", minutes: 3000, price: 149 },
];

/**
 * Récupère le PRICE_ID Stripe pour un plan donné
 * @throws Error si le PRICE_ID n'est pas configuré
 */
export function getStripePriceId(plan: PlanType, period: BillingPeriod): string {
  const envKey = `STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`;
  const priceId = process.env[envKey];

  if (!priceId || priceId.trim() === "") {
    throw new Error(
      `PRICE_ID manquant pour ${plan} (${period}). Ajoutez ${envKey} dans .env.local`
    );
  }

  return priceId;
}

/**
 * Récupère le PRICE_ID Stripe pour un pack donné (index dans PACKS)
 * @throws Error si le PRICE_ID n'est pas configuré
 */
export function getStripePriceIdForPack(packIndex: number): string {
  const pack = PACKS[packIndex];
  if (!pack) {
    throw new Error(`Pack invalide à l'index ${packIndex}`);
  }

  const envKey = `STRIPE_PRICE_PACK_${pack.minutes}`;
  const priceId = process.env[envKey];

  if (!priceId || priceId.trim() === "") {
    throw new Error(
      `PRICE_ID manquant pour le pack ${pack.name}. Ajoutez ${envKey} dans .env.local`
    );
  }

  return priceId;
}

/**
 * Valide que tous les PRICE_ID nécessaires sont configurés
 * @throws Error si un PRICE_ID manque
 */
export function validateStripeConfig(): void {
  const requiredPlans: Array<[PlanType, BillingPeriod]> = [
    ["student", "monthly"],
    ["student", "yearly"],
    ["pro", "monthly"],
    ["pro", "yearly"],
    ["business", "monthly"],
    ["business", "yearly"],
  ];

  const missing: string[] = [];

  for (const [plan, period] of requiredPlans) {
    try {
      getStripePriceId(plan, period);
    } catch (error) {
      if (error instanceof Error) {
        missing.push(error.message);
      }
    }
  }

  for (let i = 0; i < PACKS.length; i++) {
    try {
      getStripePriceIdForPack(i);
    } catch (error) {
      if (error instanceof Error) {
        missing.push(error.message);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Configuration Stripe incomplète:\n${missing.join("\n")}\n\nCréez les produits/prices dans Stripe Dashboard et ajoutez les PRICE_ID dans .env.local`
    );
  }
}
