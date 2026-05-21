import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "Pricing | LaunchRadar",
};

export default async function PricingPage() {
  const user = await getCurrentUser();
  const dashboardHref = user ? "/dashboard" : "/signup";

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
              Planned
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
          <Link
            href="/dashboard/settings"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md border border-moss bg-white px-5 text-sm font-semibold text-moss transition hover:bg-moss/5"
          >
            Check account status
          </Link>
          <p className="mt-4 text-xs leading-5 text-ink/50">
            Stripe checkout will be connected before any account can become Pro.
            The app will not mark subscriptions active without billing data.
          </p>
        </article>
      </section>
    </main>
  );
}
