import Link from "next/link";
import { redirect } from "next/navigation";
import {
  refreshHomepageExamplesFromValidationAction,
  runFailedValidationCasesAction,
  runFollowUpValidationScanAction,
  runFullValidationSuiteAction,
  runScenarioValidationAction,
  runSingleUrlValidationAction,
} from "@/app/admin/validation/actions";
import { SetupNeeded } from "@/components/setup-needed";
import { getCurrentUser } from "@/lib/auth";
import type { ValidationRun } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";
import { isMasterAdminEmail } from "@/lib/master-admin";
import { getValidationRuns } from "@/lib/validation/suite";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Validation | LaunchRadar",
};

type CaseSummary = {
  product_name?: string;
  analyzer_status?: string;
  pricing_status?: string;
  positioning_status?: string;
  cta_status?: string;
  feature_status?: string;
  competitor_count?: number;
  recommendations_status?: string;
  day_one_baseline_status?: string;
  failures?: string[];
  warnings?: string[];
  ship_ready_for_this_case?: boolean;
  follow_up_comparison?: {
    status?: string;
    changed_models?: string[];
  };
};

function statusClass(status: string) {
  if (status === "passed" || status === "created" || status === "found") {
    return "bg-moss/10 text-moss";
  }

  if (status === "partial" || status === "unclear" || status === "not_public") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-red-50 text-red-700";
}

function casesFromRun(run: ValidationRun | null): CaseSummary[] {
  const report = run?.report_json;

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return [];
  }

  return Array.isArray(report.cases)
    ? report.cases.filter(
        (item): item is CaseSummary =>
          Boolean(item && typeof item === "object" && !Array.isArray(item)),
      )
    : [];
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-md bg-ink p-3 text-xs leading-5 text-white">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function ValidationAdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isMasterAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <SetupNeeded
        title="Validation unavailable"
        message="SUPABASE_SERVICE_ROLE_KEY is required to store validation history."
      />
    );
  }

  const runs = await getValidationRuns(12);
  const latest = runs[0] ?? null;
  const latestCases = casesFromRun(latest);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <Link href="/dashboard/admin" className="text-sm font-semibold text-moss">
          Back to admin
        </Link>
        <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Master validation
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">
              Product readiness suite
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
              Deterministic, no-AI checks for analyzer reliability, baseline
              usefulness, recommendations, homepage examples, and tomorrow-ready
              model hashes.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <form action={runFullValidationSuiteAction}>
              <button className="h-10 rounded-md bg-moss px-4 text-sm font-semibold text-white">
                Run 10-SaaS suite
              </button>
            </form>
            <form action={runFailedValidationCasesAction}>
              <button className="h-10 rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-ink">
                Rerun failed
              </button>
            </form>
            <form action={runFollowUpValidationScanAction}>
              <button className="h-10 rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-ink">
                Run follow-up scan
              </button>
            </form>
            <form action={refreshHomepageExamplesFromValidationAction}>
              <button className="h-10 rounded-md border border-moss/30 bg-moss/10 px-4 text-sm font-semibold text-moss">
                Refresh examples
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Latest status", latest?.status ?? "not run"],
          [
            "Latest score",
            latest ? `${latest.passed_count}/${latest.case_count}` : "0/0",
          ],
          ["History", `${runs.length} runs`],
          [
            "AI mode",
            latest?.report_json &&
            typeof latest.report_json === "object" &&
            !Array.isArray(latest.report_json) &&
            latest.report_json.ai_enabled === false
              ? "disabled"
              : "not verified",
          ],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border border-ink/10 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
              {label}
            </p>
            <p className="mt-3 text-lg font-semibold text-ink">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form
          action={runSingleUrlValidationAction}
          className="rounded-lg border border-ink/10 bg-white p-5"
        >
          <h2 className="text-lg font-semibold text-ink">Single URL analysis</h2>
          <label className="mt-4 block text-sm font-semibold text-ink/65">
            SaaS URL
            <input
              name="url"
              placeholder="example.com"
              className="mt-2 h-11 w-full rounded-md border border-ink/15 px-3 text-sm"
            />
          </label>
          <button className="mt-4 h-10 rounded-md bg-ink px-4 text-sm font-semibold text-white">
            Run single URL
          </button>
        </form>

        <form
          action={runScenarioValidationAction}
          className="rounded-lg border border-ink/10 bg-white p-5"
        >
          <h2 className="text-lg font-semibold text-ink">
            Your Product + 2 competitors
          </h2>
          {[
            ["productUrl", "Your product URL"],
            ["competitorA", "Competitor URL 1"],
            ["competitorB", "Competitor URL 2"],
          ].map(([name, label]) => (
            <label key={name} className="mt-3 block text-sm font-semibold text-ink/65">
              {label}
              <input
                name={name}
                placeholder="example.com"
                className="mt-2 h-11 w-full rounded-md border border-ink/15 px-3 text-sm"
              />
            </label>
          ))}
          <button className="mt-4 h-10 rounded-md bg-ink px-4 text-sm font-semibold text-white">
            Run scenario
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-ink">Latest case report</h2>
            <p className="mt-1 text-sm text-ink/55">
              {latest
                ? `${latest.run_type} run at ${formatDateTime(latest.created_at)}`
                : "No validation run yet."}
            </p>
          </div>
          {latest ? (
            <Link
              href={`/admin/validation/export/${latest.id}`}
              className="inline-flex h-10 items-center rounded-md border border-moss/30 bg-moss/10 px-4 text-sm font-semibold text-moss"
            >
              Export JSON
            </Link>
          ) : null}
        </div>

        {latestCases.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-ink/45">
                <tr>
                  <th className="py-2">Product</th>
                  <th>Analyzer</th>
                  <th>Pricing</th>
                  <th>Positioning</th>
                  <th>CTA</th>
                  <th>Features</th>
                  <th>Competitors</th>
                  <th>Recommendation</th>
                  <th>Baseline</th>
                  <th>Follow-up</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {latestCases.map((item) => (
                  <tr key={item.product_name} className="border-t border-ink/10 align-top">
                    <td className="py-3 font-semibold text-ink">
                      {item.product_name}
                    </td>
                    {[
                      item.analyzer_status,
                      item.pricing_status,
                      item.positioning_status,
                      item.cta_status,
                      item.feature_status,
                    ].map((status, index) => (
                      <td key={`${item.product_name}:${index}`}>
                        <span className={`rounded-full px-2 py-1 font-semibold ${statusClass(status ?? "failed")}`}>
                          {status ?? "failed"}
                        </span>
                      </td>
                    ))}
                    <td>{item.competitor_count ?? 0}</td>
                    <td className="max-w-[180px] text-ink/60">
                      {item.recommendations_status}
                    </td>
                    <td>{item.day_one_baseline_status}</td>
                    <td className="max-w-[180px] text-ink/60">
                      {item.follow_up_comparison?.status ?? "ready"}
                      {item.follow_up_comparison?.changed_models?.length
                        ? `: ${item.follow_up_comparison.changed_models.join(", ")}`
                        : ""}
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-1 font-semibold ${statusClass(item.ship_ready_for_this_case ? "passed" : "failed")}`}>
                        {item.ship_ready_for_this_case ? "pass" : "fail"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-md bg-paper p-4 text-sm text-ink/65">
            Run the validation suite to generate readiness evidence.
          </p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Validation history</h2>
          <div className="mt-4 space-y-3">
            {runs.map((run) => (
              <div key={run.id} className="rounded-md bg-paper p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">{run.run_type}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(run.status)}`}>
                    {run.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/55">
                  {run.passed_count}/{run.case_count} passed -{" "}
                  {formatDateTime(run.created_at)}
                </p>
                <Link
                  href={`/admin/validation/export/${run.id}`}
                  className="mt-2 inline-flex text-xs font-semibold text-moss"
                >
                  Export JSON
                </Link>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Latest JSON</h2>
          <div className="mt-4">
            <JsonBlock value={latest?.report_json ?? null} />
          </div>
        </article>
      </section>
    </main>
  );
}
