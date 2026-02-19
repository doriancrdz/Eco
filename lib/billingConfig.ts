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
 * STRIPE_PRICE_STUDENT_ANNUAL_COMMIT_MONTHLY=price_xxx  (paiement mensuel, engagement 12 mois)
 * STRIPE_PRICE_PRO_ANNUAL_COMMIT_MONTHLY=price_xxx
 * STRIPE_PRICE_BUSINESS_ANNUAL_COMMIT_MONTHLY=price_xxx
 * STRIPE_PRICE_PACK_800=price_xxx
 * STRIPE_PRICE_PACK_2000=price_xxx
 * STRIPE_PRICE_PACK_6000=price_xxx
 */

export type PlanType = "free" | "student" | "pro" | "business";
export type BillingPeriod = "monthly" | "yearly";
/** yearly_upfront = paiement annuel en 1 fois ; annual_commit_monthly = mensuel avec engagement 12 mois */
export type BillingMode = "monthly" | "yearly_upfront" | "annual_commit_monthly";

export interface PlanConfig {
  name: string;
  minutesPerMonth: number;
  priceMonthly: number; // Prix mensuel SANS engagement (en euros)
  priceYearly: number; // Prix annuel upfront (paiement en une fois, en euros)
  priceAnnualCommitMonthly: number; // Prix mensuel AVEC engagement 12 mois (en euros)
  yearlyDiscountPercent: number; // Pourcentage d'économie en mode annuel
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    name: "Free",
    minutesPerMonth: 10,
    priceMonthly: 0,
    priceYearly: 0,
    priceAnnualCommitMonthly: 0,
    yearlyDiscountPercent: 0,
  },
  student: {
    name: "Student",
    minutesPerMonth: 800,
    priceMonthly: 19, // Prix mensuel SANS engagement
    priceYearly: 192, // Prix annuel upfront (paiement en une fois)
    priceAnnualCommitMonthly: 16, // Prix mensuel AVEC engagement 12 mois
    yearlyDiscountPercent: 16, // Économie: (19-16)/19 * 100 ≈ 16% (2 mois offerts sur 12)
  },
  pro: {
    name: "Pro",
    minutesPerMonth: 2000,
    priceMonthly: 49, // Prix mensuel SANS engagement
    priceYearly: 480, // Prix annuel upfront (paiement en une fois)
    priceAnnualCommitMonthly: 40, // Prix mensuel AVEC engagement 12 mois
    yearlyDiscountPercent: 18, // Économie: (49-40)/49 * 100 ≈ 18% (2 mois offerts sur 12)
  },
  business: {
    name: "Business",
    minutesPerMonth: 6000,
    priceMonthly: 149, // Prix mensuel SANS engagement
    priceYearly: 1500, // Prix annuel upfront (paiement en une fois)
    priceAnnualCommitMonthly: 125, // Prix mensuel AVEC engagement 12 mois
    yearlyDiscountPercent: 16, // Économie: (149-125)/149 * 100 ≈ 16% (2 mois offerts sur 12)
  },
};

export interface PackConfig {
  name: string;
  minutes: number;
  price: number; // en euros
}

export const PACKS: PackConfig[] = [
  { name: "Pack +800 min", minutes: 800, price: 15 },
  { name: "Pack +2000 min", minutes: 2000, price: 49 },
  { name: "Pack +6000 min", minutes: 6000, price: 149 },
];

/**
 * Durée maximale d'un enregistrement en minutes
 */
export const MAX_RECORDING_DURATION_MINUTES = 60;

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

  // Utiliser les minutes du pack pour construire la clé env (800, 2000, 6000)
  const envKey = `STRIPE_PRICE_PACK_${pack.minutes}`;
  const priceId = process.env[envKey];

  if (!priceId || priceId.trim() === "") {
    throw new Error(
      `PRICE_ID manquant pour le pack ${pack.name}. Ajoutez ${envKey} dans .env.local`
    );
  }

  return priceId;
}

/** Plans payants (sans free) pour annual commit monthly */
const PAID_PLANS: PlanType[] = ["student", "pro", "business"];

/**
 * Récupère le PRICE_ID Stripe pour un plan en "annual commit monthly" (paiement mensuel, engagement 12 mois)
 * @throws Error si le PRICE_ID n'est pas configuré
 */
export function getStripePriceIdAnnualCommitMonthly(plan: PlanType): string {
  if (plan === "free") {
    throw new Error("Le plan free n'a pas de price annual_commit_monthly");
  }
  const envKey = `STRIPE_PRICE_${plan.toUpperCase()}_ANNUAL_COMMIT_MONTHLY`;
  const priceId = process.env[envKey];

  if (!priceId || priceId.trim() === "") {
    throw new Error(
      `PRICE_ID manquant pour ${plan} (annual_commit_monthly). Ajoutez ${envKey} dans .env.local`
    );
  }

  return priceId;
}

/**
 * Vérifie si un priceId Stripe correspond au mode annual_commit_monthly (par comparaison aux env)
 */
export function isAnnualCommitMonthlyPriceId(priceId: string): boolean {
  if (!priceId) return false;
  for (const plan of PAID_PLANS) {
    try {
      if (getStripePriceIdAnnualCommitMonthly(plan) === priceId) return true;
    } catch {
      // env non configuré pour ce plan, continuer
    }
  }
  return false;
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
