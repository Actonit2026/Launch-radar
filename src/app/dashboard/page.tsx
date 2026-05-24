import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { AddCompetitorDialog } from "@/components/add-competitor-dialog";
import { ChangeCard } from "@/components/change-card";
import { DeleteCompetitorButton } from "@/components/delete-competitor-button";
import { IntelligenceSnapshotPanel } from "@/components/intelligence-snapshot-panel";
import { RunScanButton } from "@/components/run-scan-button";
import { SetupNeeded } from "@/components/setup-needed";
import { getCurrentUser } from "@/lib/auth";
import {
  getDashboardData,
  type DashboardCompetitor,
  type DashboardData,
} from "@/lib/competitors";
import { formatDateTime, formatPageType } from "@/lib/format";
import { buildIntelligenceDisplay } from "@/lib/intelligence/display";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard | LaunchRadar",
};

function setupStatusText(competitor: DashboardCompetitor) {
  if (competitor.scan_status === "failed") {
    return `Scan failed. ${
      competitor.last_scan_error ?? "Retry when the website is reachable."
    }`;
  }

  if (competitor.scan_status === "running") {
    return "Setting up your first scan...";
  }

  if (competitor.lastCheckedAt) {
    return `Baseline created. Last scanned ${formatDateTime(
      competitor.lastCheckedAt,
    )}. Snapshot pending.`;
  }

  return "Setting up your first scan...";
}

function DashboardActionPanel({ data }: { data: DashboardData }) {
  const addCompetitor = (
    <AddCompetitorDialog
      competitorCount={data.plan.competitorCount}
      competitorLimit={data.plan.competitorLimit}
      planLabel={data.plan.label}
    />
  );

  if (!data.stats.competitors) {
    return (
      <section className="rounded-lg border border-moss/20 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
              Next best action
            </p>
            <h2 className="mt-2 text-xl font-semibold text-ink">
              Add your first competitor
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Paste a public SaaS URL to create a baseline and verified snapshot.
            </p>
          </div>
          {addCompetitor}
        </div>
      </section>
    );
  }

  if (data.product.topRecommendation) {
    return (
      <section className="rounded-lg border border-moss/20 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
              Next best action
            </p>
            <h2 className="mt-2 text-xl font-semibold text-ink">
              Act on the top recommendation
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
              {data.product.topRecommendation.title}
            </p>
          </div>
          <Link
            href="/dashboard/your-product"
            className="inline-flex h-11 items-center justify-center rounded-md bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90"
          >
            Review recommendation
          </Link>
        </div>
      </section>
    );
  }

  if (data.recentChanges[0]) {
    const change = data.recentChanges[0];

    return (
      <section className="rounded-lg border border-moss/20 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
              Next best action
            </p>
            <h2 className="mt-2 text-xl font-semibold text-ink">
              Review the latest meaningful change
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
              {change.competitor.name}:{" "}
              {change.diff_summary.split(/(?<=[.!?])\s+/)[0]}
            </p>
          </div>
          <Link
            href={`/dashboard/competitors/${change.competitor.id}`}
            className="inline-flex h-11 items-center justify-center rounded-md bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90"
          >
            Review change
          </Link>
        </div>
      </section>
    );
  }

  if (!data.product.exists) {
    return (
      <section className="rounded-lg border border-moss/20 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
              Next best action
            </p>
            <h2 className="mt-2 text-xl font-semibold text-ink">
              Add your product for recommendations
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Compare your public page against tracked competitors to find
              evidence-backed improvements.
            </p>
          </div>
          <Link
            href="/dashboard/your-product"
            className="inline-flex h-11 items-center justify-center rounded-md bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90"
          >
            Add your product
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-moss/20 bg-white p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
            Market pulse
          </p>
          <h2 className="mt-2 text-xl font-semibold text-ink">
            No meaningful changes detected this week
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            Run a pulse check when you want a fresh read, or add another
            competitor for broader coverage.
          </p>
        </div>
        <RunScanButton />
      </div>
    </section>
  );
}

export default async function DashboardPage() {
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

  const data = result.data;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <section className="flex flex-col justify-between gap-5 rounded-lg border border-ink/10 bg-white p-6 shadow-soft sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
            LaunchRadar
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-2 text-sm text-ink/65">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {data?.plan.masterAdmin ? (
            <Link
              href="/dashboard/admin"
              className="inline-flex h-11 items-center justify-center rounded-md border border-moss/30 bg-moss/10 px-5 text-sm font-semibold text-moss transition hover:border-moss/50"
            >
              Admin
            </Link>
          ) : null}
          <Link
            href="/dashboard/your-product"
            className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/35"
          >
            Your Product
          </Link>
          <Link
            href="/dashboard/settings"
            className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/35"
          >
            Settings
          </Link>
          <form action={signOutAction}>
            <button className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90">
              Sign out
            </button>
          </form>
        </div>
      </section>

      {data ? (
        <section className="rounded-lg border border-moss/15 bg-white p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold text-ink">
                {data.plan.label} plan: {data.plan.competitorCount}/
                {data.plan.competitorLimit} competitors tracked
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                {data.plan.masterAdmin
                  ? "Master admin bypass is active for product limits, scan limits, analyzer debugging, and launch operations."
                  : "Free refresh target is weekly. Upgrade to Pro for 20 competitors, 12-hour refreshes, email alerts, and Your Product recommendations."}
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-md bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90"
            >
              View plans
            </Link>
          </div>
        </section>
      ) : null}

      {data ? <DashboardActionPanel data={data} /> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-ink/10 bg-white p-5">
          <p className="text-sm font-medium text-ink/55">Competitors</p>
          <p className="mt-4 text-3xl font-semibold text-ink">
            {data?.stats.competitors ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-5">
          <p className="text-sm font-medium text-ink/55">Tracked pages</p>
          <p className="mt-4 text-3xl font-semibold text-ink">
            {data?.stats.trackedPages ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-ink/10 bg-white p-5">
          <p className="text-sm font-medium text-ink/55">Recent changes</p>
          <p className="mt-4 text-3xl font-semibold text-ink">
            {data?.stats.changes ?? 0}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-ink/10 bg-white p-5">
          <div className="flex items-center justify-between gap-5">
            <h2 className="text-lg font-semibold text-ink">
              Tracked competitors
            </h2>
            <p className="text-sm text-ink/50">
              {data?.competitors.length ?? 0} total
            </p>
          </div>

          {data?.competitors.length ? (
            <div className="mt-5 space-y-4">
              {data.competitors.map((competitor) => (
                (() => {
                  const intelligence = buildIntelligenceDisplay(
                    competitor.latestIntelligence,
                  );

                  return (
                    <article
                      key={competitor.id}
                      className="rounded-md border border-ink/10 p-4"
                    >
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/competitors/${competitor.id}`}
                            className="text-lg font-semibold text-ink transition hover:text-moss"
                          >
                            {competitor.name}
                          </Link>
                          <a
                            href={competitor.base_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block truncate text-sm text-ink/60 transition hover:text-ink"
                          >
                            {competitor.base_url}
                          </a>
                        </div>
                        <DeleteCompetitorButton competitorId={competitor.id} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {competitor.monitoredPages.map((page) => (
                          <span
                            key={page.id}
                            className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/65"
                          >
                            {formatPageType(page.page_type)}
                          </span>
                        ))}
                      </div>

                      {intelligence ? (
                        <IntelligenceSnapshotPanel
                          display={intelligence}
                          compact
                        />
                      ) : (
                        <p className="mt-4 text-sm leading-6 text-ink/55">
                          {setupStatusText(competitor)}
                        </p>
                      )}

                      {competitor.latestChange ? (
                        <div className="mt-4 border-t border-ink/10 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
                            Latest confirmed change
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-ink/75">
                            {
                              competitor.latestChange.diff_summary.split(
                                /(?<=[.!?])\s+/,
                              )[0]
                            }
                          </p>
                        </div>
                      ) : null}
                    </article>
                  );
                })()
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-md bg-paper p-5">
              <h3 className="font-semibold text-ink">No competitors yet</h3>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Add a competitor URL to discover public pages, create a
                baseline, and generate the first verified snapshot.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Recent changes</h2>

          {data?.recentChanges.length ? (
            <div className="mt-5 space-y-4">
              {data.recentChanges.map((change) => (
                <ChangeCard
                  key={change.id}
                  id={change.id}
                  summary={change.diff_summary}
                  severity={change.severity}
                  changeType={change.change_type}
                  evidenceJson={change.evidence_json}
                  createdAt={change.created_at}
                  pageType={change.page.page_type}
                  pageUrl={change.page.url}
                  competitorName={change.competitor.name}
                  competitorHref={`/dashboard/competitors/${change.competitor.id}`}
                />
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-md bg-paper p-4 text-sm leading-6 text-ink/65">
              No meaningful changes detected this week. Minor formatting and
              technical changes are ignored.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
