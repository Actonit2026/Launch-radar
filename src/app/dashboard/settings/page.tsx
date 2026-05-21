import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { SetupNeeded } from "@/components/setup-needed";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/competitors";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings | LaunchRadar",
};

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) {
    return <SetupNeeded message={supabaseConfigMessage} />;
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const result = await getDashboardData(user);

  if (result.error) {
    return <SetupNeeded title="Run database schema" message={result.error} />;
  }

  const competitorCount = result.data?.stats.competitors ?? 0;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-moss transition hover:text-moss/80"
        >
          Back to dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Settings</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          Manage your account, plan, and scan expectations.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-ink/55">Email</dt>
              <dd className="mt-1 text-ink">{user.email}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/forgot-password"
              className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink/35"
            >
              Reset password
            </Link>
            <form action={signOutAction}>
              <button className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90">
                Sign out
              </button>
            </form>
          </div>
        </article>

        <article className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Plan</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-ink/55">Current plan</dt>
              <dd className="mt-1 text-ink">Free</dd>
            </div>
            <div>
              <dt className="font-medium text-ink/55">Competitors tracked</dt>
              <dd className="mt-1 text-ink">{competitorCount}/3</dd>
            </div>
            <div>
              <dt className="font-medium text-ink/55">Refresh cadence</dt>
              <dd className="mt-1 text-ink">
                Initial scan on add, then daily refresh when scheduler limits
                allow.
              </dd>
            </div>
          </dl>
          <p className="mt-5 rounded-md bg-paper p-4 text-sm leading-6 text-ink/65">
            Pro billing is not enabled yet. Phase 4 will enforce plan limits and
            add the upgrade path without faking subscriptions.
          </p>
        </article>
      </section>
    </main>
  );
}
