import { NextResponse } from "next/server";
import Stripe from "stripe";
import type { Database } from "@/lib/database.types";
import { getStripe, planForStripePrice } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function customerIdFromSubscription(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = subscription.items.data[0]?.current_period_end;

  return typeof periodEnd === "number"
    ? new Date(periodEnd * 1000).toISOString()
    : null;
}

function isActiveSubscription(status: Stripe.Subscription.Status) {
  return status === "active" || status === "trialing";
}

type SubscriptionPlanUpdateResult = {
  ok: boolean;
  warning?: string;
};
type UserUpdate = Database["public"]["Tables"]["users"]["Update"];
type BillingPlan = NonNullable<UserUpdate["plan"]>;

async function setUserPlanFromSubscription({
  userId,
  subscription,
  customerId,
}: {
  userId?: string | null;
  subscription: Stripe.Subscription;
  customerId: string;
}): Promise<SubscriptionPlanUpdateResult> {
  const supabase = getSupabaseAdminClient();
  const active = isActiveSubscription(subscription.status);
  const priceId = subscription.items.data[0]?.price.id;
  const activePlan: BillingPlan | null = active ? planForStripePrice(priceId) : "free";

  if (!activePlan) {
    const warning = `Unknown Stripe price ID for subscription ${subscription.id}.`;

    console.error(warning, { priceId });
    return { ok: false, warning };
  }

  const payload: UserUpdate = active
    ? {
        plan: activePlan,
        competitor_limit: activePlan === "business" ? 999 : 20,
        scan_interval_hours: activePlan === "business" ? 6 : 12,
        subscription_status: subscription.status,
        current_period_end: subscriptionPeriodEnd(subscription),
        billing_customer_id: customerId,
        billing_subscription_id: subscription.id,
      }
    : {
        plan: "free" as const,
        competitor_limit: 3,
        scan_interval_hours: 168,
        subscription_status: subscription.status,
        current_period_end: subscriptionPeriodEnd(subscription),
        billing_customer_id: customerId,
        billing_subscription_id: subscription.id,
      };

  if (userId) {
    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", userId)
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.length) {
      const warning = `No user row matched Stripe subscription ${subscription.id}.`;

      console.error(warning, { userId, customerId });
      return { ok: false, warning };
    }

    return { ok: true };
  }

  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("billing_customer_id", customerId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    const warning = `No user row matched Stripe customer ${customerId}.`;

    console.error(warning, { subscriptionId: subscription.id });
    return { ok: false, warning };
  }

  return { ok: true };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || !session.subscription) {
    return { ok: true } satisfies SubscriptionPlanUpdateResult;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id,
  );
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? customerIdFromSubscription(subscription);

  return setUserPlanFromSubscription({
    userId: session.metadata?.user_id ?? session.client_reference_id,
    subscription,
    customerId,
  });
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  return setUserPlanFromSubscription({
    userId: subscription.metadata?.user_id,
    subscription,
    customerId: customerIdFromSubscription(subscription),
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Stripe webhook secret is unavailable.");
    return NextResponse.json(
      { error: "Webhook is unavailable." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("Stripe webhook request missing signature.");
    return NextResponse.json({ error: "Invalid webhook request." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    console.error("Stripe webhook signature verification failed.");
    return NextResponse.json({ error: "Invalid webhook request." }, { status: 400 });
  }

  try {
    const warnings: string[] = [];

    switch (event.type) {
      case "checkout.session.completed":
        {
          const result = await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          );

          if (result.warning) warnings.push(result.warning);
        }
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        {
          const result = await handleSubscriptionChanged(
          event.data.object as Stripe.Subscription,
          );

          if (result.warning) warnings.push(result.warning);
        }
        break;
      default:
        break;
    }

    return NextResponse.json({
      received: true,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process webhook.";

    console.error("Stripe webhook processing failed.", { error: message });
    return NextResponse.json({ error: "Could not process webhook." }, { status: 500 });
  }
}
