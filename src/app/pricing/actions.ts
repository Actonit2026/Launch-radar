"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentUser } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/profiles";
import {
  getAnnualBusinessPriceId,
  getAnnualProPriceId,
  getBusinessPriceId,
  getProPriceId,
  getStripe,
} from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

function optionalPriceId(getter: () => string) {
  try {
    return getter();
  } catch (error) {
    console.error("Stripe checkout price is unavailable.", { error });
    return null;
  }
}

async function createCheckoutSessionAction(priceId: string | null) {
  if (!priceId) {
    redirect("/pricing?billing=unavailable");
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/signup");
  }

  const supabase = await createClient();
  const profileError = await ensureUserProfile(supabase, user);

  if (profileError) {
    throw new Error(profileError);
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("email, billing_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  let stripe: ReturnType<typeof getStripe>;

  try {
    stripe = getStripe();
  } catch (error) {
    console.error("Stripe checkout is unavailable.", { error });
    redirect("/pricing?billing=unavailable");
  }

  let customerId = profile?.billing_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? profile?.email ?? undefined,
      metadata: {
        user_id: user.id,
      },
    });

    customerId = customer.id;

    await supabase
      .from("users")
      .update({ billing_customer_id: customerId })
      .eq("id", user.id);
  }

  const appUrl = getAppUrl(await headers());
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/dashboard/settings?billing=success`,
    cancel_url: `${appUrl}/pricing?billing=cancelled`,
    client_reference_id: user.id,
    metadata: {
      user_id: user.id,
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(session.url);
}

export async function createProCheckoutSessionAction() {
  return createCheckoutSessionAction(optionalPriceId(getProPriceId));
}

export async function createAnnualProCheckoutSessionAction() {
  return createCheckoutSessionAction(optionalPriceId(getAnnualProPriceId));
}

export async function createBusinessCheckoutSessionAction() {
  return createCheckoutSessionAction(optionalPriceId(getBusinessPriceId));
}

export async function createAnnualBusinessCheckoutSessionAction() {
  return createCheckoutSessionAction(optionalPriceId(getAnnualBusinessPriceId));
}

export async function createBillingPortalSessionAction() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("users")
    .select("billing_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!profile?.billing_customer_id) {
    redirect("/pricing");
  }

  const appUrl = getAppUrl(await headers());
  let stripe: ReturnType<typeof getStripe>;

  try {
    stripe = getStripe();
  } catch (error) {
    console.error("Stripe billing portal is unavailable.", { error });
    redirect("/pricing?billing=unavailable");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.billing_customer_id,
    return_url: `${appUrl}/dashboard/settings`,
  });

  redirect(session.url);
}
