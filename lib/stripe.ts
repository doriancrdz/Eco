import Stripe from "stripe";

const API_VERSION = "2025-02-24.acacia" as const;

export function getStripeOrNull() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  return new Stripe(key, {
    apiVersion: API_VERSION,
    typescript: true,
  });
}
