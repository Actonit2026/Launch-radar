import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
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

async function setUserPlanFromSubscription({
  userId,
  subscription,
  customerId,
}: {
  userId?: string | null;
  subscription: Stripe.Subscription;
  customerId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const active = isActiveSubscription(subscription.status);
  const payload = active
    ? {
        plan: "pro" as const,
        competitor_limit: 20,
        scan_interval_hours: 12,
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
    await supabase.from("users").update(payload).eq("id", userId);
    return;
  }

  await supabase
    .from("users")
    .update(payload)
    .eq("billing_customer_id", customerId);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || !session.subscription) {
    return;
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

  await setUserPlanFromSubscription({
    userId: session.metadata?.user_id ?? session.client_reference_id,
    subscription,
    customerId,
  });
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  await setUserPlanFromSubscription({
    userId: subscription.metadata?.user_id,
    subscription,
    customerId: customerIdFromSubscription(subscription),
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChanged(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process webhook.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
