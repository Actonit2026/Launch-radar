import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID);
}

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    });
  }

  return stripeClient;
}

export function getProPriceId() {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;

  if (!priceId) {
    throw new Error("STRIPE_PRO_PRICE_ID is not configured.");
  }

  return priceId;
}
