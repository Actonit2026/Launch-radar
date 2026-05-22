"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentUser } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/profiles";
import { getProPriceId, getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function createProCheckoutSessionAction() {
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

  const stripe = getStripe();
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
        price: getProPriceId(),
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
  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.billing_customer_id,
    return_url: `${appUrl}/dashboard/settings`,
  });

  redirect(session.url);
}
