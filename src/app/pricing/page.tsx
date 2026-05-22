import Link from "next/link";
import {
  createBillingPortalSessionAction,
  createProCheckoutSessionAction,
} from "@/app/pricing/actions";
import { getCurrentUser } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Pricing | LaunchRadar",
};

export default async function PricingPage() {
  const user = await getCurrentUser();
  const dashboardHref = user ? "/dashboard" : "/signup";
  const stripeReady = isStripeConfigured();
  const supabase = user ? await createClient() : null;
  const { data: profile } = user && supabase
    ? await supabase
        .from("users")
        .select("plan, billing_customer_id")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const isPro = profile?.plan === "pro";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
          Pricing
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-ink">
          Start useful, upgrade when monitoring matters.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/65">
          Free users can build a trustworthy baseline. Pro is designed for
          ongoing competitor monitoring, alerts, and product comparison.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-semibold text-ink">Free</h2>
          <p className="mt-3 text-4xl font-semibold text-ink">€0</p>
          <p className="mt-2 text-sm text-ink/55">For the first baseline.</p>
          <ul className="mt-6 space-y-3 text-sm leading-6 text-ink/70">
            <li>Track up to 3 competitors</li>
            <li>Initial scan on add</li>
            <li>Daily refresh target</li>
            <li>Basic evidence-backed intelligence snapshot</li>
          </ul>
          <Link
            href={dashboardHref}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90"
          >
            Start free
          </Link>
        </article>

        <article className="rounded-lg border border-moss/25 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-ink">Pro</h2>
            <span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">
              Live billing
            </span>
          </div>
          <p className="mt-3 text-4xl font-semibold text-ink">€19</p>
          <p className="mt-2 text-sm text-ink/55">per month</p>
          <ul className="mt-6 space-y-3 text-sm leading-6 text-ink/70">
            <li>Track up to 20 competitors</li>
            <li>12-hour refresh target</li>
            <li>Email alerts for meaningful changes</li>
            <li>Your Product comparison recommendations</li>
          </ul>
          {isPro && profile?.billing_customer_id ? (
            <form action={createBillingPortalSessionAction}>
              <button
                type="submit"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md border border-moss bg-white px-5 text-sm font-semibold text-moss transition hover:bg-moss/5"
              >
                Manage billing
              </button>
            </form>
          ) : user && stripeReady ? (
            <form action={createProCheckoutSessionAction}>
              <button
                type="submit"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90"
              >
                Upgrade to Pro
              </button>
            </form>
          ) : user ? (
            <p className="mt-6 rounded-md bg-paper p-4 text-sm leading-6 text-ink/65">
              Billing is not configured yet. Add Stripe environment variables to
              enable Pro checkout.
            </p>
          ) : (
            <Link
              href="/signup"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90"
            >
              Sign up to upgrade
            </Link>
          )}
        </article>
      </section>
    </main>
  );
}
