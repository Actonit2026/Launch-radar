import Link from "next/link";
import { redirect } from "next/navigation";
import type { PageType } from "@/lib/database.types";
import { getCurrentUser } from "@/lib/auth";
import { isMasterAdminEmail } from "@/lib/master-admin";
import { parseCompetitorUrl } from "@/lib/urls";
import { scrapePages } from "@/lib/crawler/scraper";
import { analyzePageIntelligence } from "@/lib/intelligence/analyze";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDemoExamples } from "@/lib/demo-examples";
import { refreshDemoExamplesAction } from "@/app/admin/analyzer/actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analyzer Debug | LaunchRadar",
};

type SearchParams = Promise<{
  url?: string;
}>;

function classifyPageType(url: string): PageType {
  const path = new URL(url).pathname.toLowerCase();

  if (/pricing|plans|packages|tarifs|prix|billing/.test(path)) {
    return "pricing";
  }

  if (/features|product|platform|solutions|use-cases/.test(path)) {
    return "features";
  }

  if (/changelog|updates|release-notes|releases/.test(path)) {
    return "changelog";
  }

  if (/docs|help|support|api/.test(path)) {
    return "docs";
  }

  return path === "/" ? "homepage" : "product";
}

async function analyzeUrl(rawUrl: string) {
  try {
    const parsed = parseCompetitorUrl(rawUrl);
    const targetUrl = parsed.submittedPageUrl ?? parsed.baseUrl;
    const [scrape] = await scrapePages([targetUrl]);

    if (!scrape) {
      return { error: "No scrape result returned." };
    }

    const analysis = analyzePageIntelligence({
      pageType: classifyPageType(targetUrl),
      scrape,
    });

    return {
      normalizedUrl: parsed.baseUrl,
      submittedUrl: parsed.submittedUrl,
      targetUrl,
      scrape,
      analysis,
      finalObject: {
        status: scrape.ok
          ? "success"
          : scrape.rawText
            ? "partial"
            : "failed",
        pricing: {
          status: analysis.pricing.status,
          items: analysis.pricing.items,
          selected_item: analysis.pricing.selectedItem,
          debug_candidates: analysis.pricing.debugCandidates,
        },
        positioning: analysis.positioning,
        ctas: analysis.ctas,
        features: analysis.features,
        changelog: analysis.changelog,
        warnings: analysis.warnings,
        debug: {
          page_model: scrape.pageModel ?? null,
          pricing_candidates: analysis.pricing.debugCandidates,
          rejected_pricing_candidates:
            analysis.pricing.debug.rejected_candidates,
        },
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Analyzer failed.",
    };
  }
}

async function recentScanJobs() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("scan_jobs")
    .select("id, user_id, job_type, status, attempts, last_error, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return data ?? [];
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[460px] overflow-auto rounded-md bg-ink p-4 text-xs leading-5 text-white">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function AnalyzerAdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isMasterAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const rawUrl = params.url?.trim() ?? "";
  const [result, jobs, demoCache] = await Promise.all([
    rawUrl ? analyzeUrl(rawUrl) : Promise.resolve(null),
    recentScanJobs(),
    getDemoExamples(),
  ]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <Link href="/dashboard/admin" className="text-sm font-semibold text-moss">
          Back to admin
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          Analyzer debug
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          Deterministic extraction only. This page is server-authorized for
          master admin emails.
        </p>
        <form className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            name="url"
            defaultValue={rawUrl}
            placeholder="example.com/pricing"
            className="h-11 flex-1 rounded-md border border-ink/15 px-3 text-sm"
          />
          <button className="h-11 rounded-md bg-moss px-5 text-sm font-semibold text-white">
            Analyze
          </button>
        </form>
      </section>

      {result && "error" in result ? (
        <section className="rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700">
          {result.error}
        </section>
      ) : null}

      {result && !("error" in result) ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            {[
              ["Status", result.finalObject.status],
              ["Pricing", result.analysis.pricing.status],
              ["CTA", result.analysis.ctas.primaryCta?.value ?? "None"],
              ["Features", String(result.analysis.features.features.length)],
            ].map(([label, value]) => (
              <article key={label} className="rounded-lg border border-ink/10 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                  {label}
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-lg border border-ink/10 bg-white p-5">
              <h2 className="text-lg font-semibold text-ink">Page model</h2>
              <div className="mt-4">
                <JsonBlock value={result.scrape.pageModel ?? null} />
              </div>
            </article>
            <article className="rounded-lg border border-ink/10 bg-white p-5">
              <h2 className="text-lg font-semibold text-ink">
                Pricing candidates
              </h2>
              <div className="mt-4">
                <JsonBlock value={result.analysis.pricing.debug} />
              </div>
            </article>
          </section>

          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <h2 className="text-lg font-semibold text-ink">
              Final analysis object
            </h2>
            <div className="mt-4">
              <JsonBlock value={result.finalObject} />
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded-lg border border-ink/10 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Homepage demo examples
            </h2>
            <p className="mt-1 text-sm text-ink/55">
              Last refresh: {demoCache.updated_at ?? "pending"} · Next:
              {" "}
              {demoCache.next_refresh_at ?? "unknown"}
            </p>
          </div>
          <form action={refreshDemoExamplesAction}>
            <button className="h-10 rounded-md bg-moss px-4 text-sm font-semibold text-white">
              Refresh examples
            </button>
          </form>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {demoCache.examples.map((example) => (
            <article key={example.name} className="rounded-md bg-paper p-4 text-sm">
              <p className="font-semibold text-ink">{example.name}</p>
              <p className="mt-2 text-ink/65">{example.positioning}</p>
              <p className="mt-2 text-xs text-ink/55">{example.pricing}</p>
              <p className="mt-1 text-xs text-ink/55">CTA: {example.cta}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Recent scan jobs</h2>
        {jobs.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-ink/50">
                <tr>
                  <th className="py-2">Created</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Attempts</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t border-ink/10">
                    <td className="py-2">{job.created_at}</td>
                    <td>{job.status}</td>
                    <td>{job.job_type}</td>
                    <td>{job.attempts}</td>
                    <td>{job.last_error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/60">No scan jobs found.</p>
        )}
      </section>
    </main>
  );
}
