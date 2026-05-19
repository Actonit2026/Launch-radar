import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  const href = user ? "/dashboard" : "/signup";

  return (
    <main className="mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr]">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-coral">
          Competitor intelligence
        </p>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] text-ink sm:text-6xl">
          Track every move your competitors make
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
          Get alerted when competitors change pricing, messaging, or launch
          features.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={href}
            className="inline-flex h-12 items-center justify-center rounded-md bg-moss px-6 text-sm font-semibold text-white transition hover:bg-moss/90"
          >
            Start tracking free
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-md border border-ink/15 bg-white px-6 text-sm font-semibold text-ink transition hover:border-ink/35"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section
        aria-label="LaunchRadar preview"
        className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft"
      >
        <div className="flex items-center justify-between border-b border-ink/10 pb-4">
          <div>
            <p className="text-sm font-semibold text-ink">Recent Changes</p>
            <p className="text-xs text-ink/55">Pricing and positioning</p>
          </div>
          <div className="rounded-full bg-coral/10 px-3 py-1 text-xs font-semibold text-coral">
            High
          </div>
        </div>
        <div className="space-y-4 py-5">
          <div className="rounded-md border border-ink/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-ink">Northstar CRM</p>
              <p className="text-xs text-ink/50">2h ago</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              Pricing page changed from $29 to $39 and added an annual
              discount callout.
            </p>
          </div>
          <div className="rounded-md border border-ink/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold text-ink">Atlas Billing</p>
              <p className="text-xs text-ink/50">5h ago</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink/70">
              Homepage headline now targets finance teams instead of SaaS
              founders.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md bg-paper p-3">
            <p className="text-xs text-ink/55">Competitors</p>
            <p className="mt-2 text-2xl font-semibold">12</p>
          </div>
          <div className="rounded-md bg-paper p-3">
            <p className="text-xs text-ink/55">Pages</p>
            <p className="mt-2 text-2xl font-semibold">48</p>
          </div>
          <div className="rounded-md bg-paper p-3">
            <p className="text-xs text-ink/55">Changes</p>
            <p className="mt-2 text-2xl font-semibold">7</p>
          </div>
        </div>
      </section>
    </main>
  );
}
