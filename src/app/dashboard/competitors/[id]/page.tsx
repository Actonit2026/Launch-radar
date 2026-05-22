import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { ChangeCard } from "@/components/change-card";
import { DeleteCompetitorButton } from "@/components/delete-competitor-button";
import { IntelligenceSnapshotPanel } from "@/components/intelligence-snapshot-panel";
import { ManualPageOverrideForm } from "@/components/manual-page-override-form";
import { RunScanButton } from "@/components/run-scan-button";
import { ScanDebugPanel } from "@/components/scan-debug-panel";
import { SetupNeeded } from "@/components/setup-needed";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime, formatPageType } from "@/lib/format";
import { getCompetitorDetail } from "@/lib/competitors";
import {
  buildIntelligenceDisplay,
  type IntelligenceDisplayView,
} from "@/lib/intelligence/display";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Competitor | LaunchRadar",
};

type CompetitorDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function latestCheckedAt(pages: { last_checked_at: string | null }[]) {
  return pages
    .map((page) => page.last_checked_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

function manualHelpActions(display: IntelligenceDisplayView | null) {
  if (!display) {
    return [
      "Add a pricing, product, docs, or changelog page if discovery needs help.",
    ];
  }

  return [
    ...(display.pricing.status !== "found"
      ? ["We could not confidently find a pricing page. Add pricing page URL."]
      : []),
    ...(display.changelog.status !== "found"
      ? ["No changelog detected. Add updates/changelog page manually."]
      : []),
    ...(display.features.status !== "found"
      ? ["Feature information was limited. Add product/features page."]
      : []),
  ];
}

export default async function CompetitorDetailPage({
  params,
}: CompetitorDetailPageProps) {
  if (!isSupabaseConfigured()) {
    return <SetupNeeded message={supabaseConfigMessage} />;
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const result = await getCompetitorDetail(user, id);

  if (result.error) {
    return <SetupNeeded title="Run database schema" message={result.error} />;
  }

  if (!result.data) {
    notFound();
  }

  const { competitor, pages, changes, latestIntelligence, debugLogs } =
    result.data;
  const intelligence = buildIntelligenceDisplay(latestIntelligence);
  const latestPageCheck = latestCheckedAt(pages);
  const helpActions = manualHelpActions(intelligence);
  const setupStatus =
    competitor.scan_status === "failed"
      ? `Scan failed. ${
          competitor.last_scan_error ?? "Retry when the website is reachable."
        }`
      : competitor.scan_status === "running"
        ? "Setting up your first scan..."
        : latestPageCheck
          ? `Baseline created. Last scanned ${formatDateTime(
              latestPageCheck,
            )}. Snapshot pending.`
          : "Setting up your first scan...";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <section className="flex flex-col justify-between gap-5 rounded-lg border border-ink/10 bg-white p-6 shadow-soft sm:flex-row sm:items-start">
        <div>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-moss transition hover:text-moss/80"
          >
            Back to dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-ink">
            {competitor.name}
          </h1>
          <a
            href={competitor.base_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-sm text-ink/65 transition hover:text-ink"
          >
            {competitor.base_url}
          </a>
          <p className="mt-2 text-xs text-ink/45">
            Added {formatDateTime(competitor.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <RunScanButton />
          <DeleteCompetitorButton
            competitorId={competitor.id}
            redirectTo="/dashboard"
          />
          <form action={signOutAction}>
            <button className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/90">
              Sign out
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Verified intelligence
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink/55">
              Evidence-backed facts from the latest baseline snapshot.
            </p>
          </div>
          {latestPageCheck ? (
            <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/55">
              Last scan {formatDateTime(latestPageCheck)}
            </span>
          ) : null}
        </div>

        {intelligence ? (
          <IntelligenceSnapshotPanel display={intelligence} />
        ) : (
          <p className="mt-5 rounded-md bg-paper p-4 text-sm leading-6 text-ink/65">
            {setupStatus}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">
          Manual page fallback
        </h2>
        {helpActions.length ? (
          <div className="mt-3 space-y-2 text-sm leading-6 text-ink/60">
            {helpActions.map((action) => (
              <p key={action}>{action}</p>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-ink/60">
            Discovery looks healthy. You can still add or replace a page and
            refresh the verified snapshot.
          </p>
        )}
        <div className="mt-5">
          <ManualPageOverrideForm competitorId={competitor.id} />
        </div>
      </section>

      <ScanDebugPanel logs={debugLogs} />

      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Tracked pages</h2>
          <div className="mt-5 space-y-3">
            {pages.map((page) => (
              <div
                key={page.id}
                className="rounded-md border border-ink/10 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">
                    {formatPageType(page.page_type)}
                  </span>
                  <span className="text-xs text-ink/45">
                    {page.last_checked_at
                      ? formatDateTime(page.last_checked_at)
                      : "Not checked yet"}
                  </span>
                </div>
                <a
                  href={page.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block truncate text-sm text-ink/70 transition hover:text-ink"
                >
                  {page.url}
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Change history</h2>
          {changes.length ? (
            <div className="mt-5 space-y-4">
              {changes.map((change) => (
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
                />
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
