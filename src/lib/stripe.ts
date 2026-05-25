import Stripe from "stripe";

let stripeClient: InstanceType<typeof Stripe> | null = null;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID);
}

export function isStripeSecretConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function hasAnnualProPriceId() {
  return Boolean(process.env.STRIPE_PRO_ANNUAL_PRICE_ID);
}

export function hasBusinessPriceId() {
  return Boolean(process.env.STRIPE_BUSINESS_PRICE_ID);
}

export function hasAnnualBusinessPriceId() {
  return Boolean(process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID);
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

export function getAnnualProPriceId() {
  const priceId = process.env.STRIPE_PRO_ANNUAL_PRICE_ID;

  if (!priceId) {
    throw new Error("STRIPE_PRO_ANNUAL_PRICE_ID is not configured.");
  }

  return priceId;
}

export function getBusinessPriceId() {
  const priceId = process.env.STRIPE_BUSINESS_PRICE_ID;

  if (!priceId) {
    throw new Error("STRIPE_BUSINESS_PRICE_ID is not configured.");
  }

  return priceId;
}

export function getAnnualBusinessPriceId() {
  const priceId = process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID;

  if (!priceId) {
    throw new Error("STRIPE_BUSINESS_ANNUAL_PRICE_ID is not configured.");
  }

  return priceId;
}

export function planForStripePrice(priceId?: string | null) {
  if (
    priceId &&
    [
      process.env.STRIPE_BUSINESS_PRICE_ID,
      process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID,
    ].includes(priceId)
  ) {
    return "business" as const;
  }

  if (
    priceId &&
    [
      process.env.STRIPE_PRO_PRICE_ID,
      process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    ].includes(priceId)
  ) {
    return "pro" as const;
  }

  return null;
}
