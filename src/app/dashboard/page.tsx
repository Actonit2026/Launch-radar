import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { AddCompetitorDialog } from "@/components/add-competitor-dialog";
import { DeleteCompetitorButton } from "@/components/delete-competitor-button";
import { IntelligenceSnapshotPanel } from "@/components/intelligence-snapshot-panel";
import { RunScanButton } from "@/components/run-scan-button";
import { SetupNeeded } from "@/components/setup-needed";
import { getCurrentUser } from "@/lib/auth";
import {
  getDashboardData,
  type DashboardCompetitor,
} from "@/lib/competitors";
import { formatDateTime, formatPageType, severityClassName } from "@/lib/format";
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
          <RunScanButton />
          <AddCompetitorDialog />
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
                        <p className="mt-4 border-t border-ink/10 pt-4 text-sm leading-6 text-ink/70">
                          Latest confirmed change:{" "}
                          {competitor.latestChange.diff_summary}
                        </p>
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
                <article
                  key={change.id}
                  className="rounded-md border border-ink/10 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClassName(
                        change.severity,
                      )}`}
                    >
                      {change.severity}
                    </span>
                    <span className="text-xs text-ink/45">
                      {formatDateTime(change.created_at)}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/competitors/${change.competitor.id}`}
                    className="mt-3 block font-semibold text-ink transition hover:text-moss"
                  >
                    {change.competitor.name}
                  </Link>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                    {formatPageType(change.page.page_type)}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-ink/70">
                    {change.diff_summary}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-md bg-paper p-4 text-sm leading-6 text-ink/65">
              No meaningful changes detected. Minor formatting or technical
              changes are ignored.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
