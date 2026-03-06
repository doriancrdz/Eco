import Stripe from "stripe";

const API_VERSION = "2025-02-24.acacia" as const;

export function getStripeOrNull() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is undefined");
  }

  return new Stripe(key, {
    apiVersion: API_VERSION,
    typescript: true,
  });
}
