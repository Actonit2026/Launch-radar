import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupNeeded } from "@/components/setup-needed";
import { getAdminCostMetrics, isAdminEmail } from "@/lib/admin-metrics";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin | LaunchRadar",
};

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <SetupNeeded
        title="Admin metrics unavailable"
        message="SUPABASE_SERVICE_ROLE_KEY is required for internal cost metrics."
      />
    );
  }

  const metrics = await getAdminCostMetrics();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-moss hover:text-moss/80"
        >
          Back to dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          Internal cost dashboard
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          Operational counters for launch safety. This page is only available
          to emails in ADMIN_EMAILS.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/admin/analyzer"
            className="inline-flex h-10 items-center justify-center rounded-md bg-moss px-4 text-sm font-semibold text-white"
          >
            Analyzer debug
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Scans today", metrics.scansToday],
          ["Pages fetched today", metrics.pagesFetchedToday],
          ["Browser renders today", metrics.browserRendersToday],
          ["AI calls today", metrics.aiCallsToday],
          ["Weekly digests today", metrics.weeklyDigestsToday],
          [
            "Estimated monthly cost",
            `EUR ${metrics.estimatedMonthlyCost} / ${metrics.monthlyBudget}`,
          ],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border border-ink/10 bg-white p-5">
            <p className="text-sm font-medium text-ink/55">{label}</p>
            <p className="mt-4 text-2xl font-semibold text-ink">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Top users by cost</h2>
        {metrics.topUsersByCost.length ? (
          <div className="mt-4 space-y-2">
            {metrics.topUsersByCost.map((row) => (
              <div
                key={row.userId}
                className="flex items-center justify-between rounded-md bg-paper px-3 py-2 text-sm"
              >
                <span className="font-mono text-ink/65">{row.userId}</span>
                <span className="font-semibold text-ink">EUR {row.cost}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-paper p-4 text-sm leading-6 text-ink/65">
            No usage events recorded this month.
          </p>
        )}
      </section>
    </main>
  );
}
