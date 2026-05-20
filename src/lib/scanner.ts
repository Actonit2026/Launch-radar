import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  DetectedChange,
  MonitoredPage,
} from "@/lib/database.types";
import {
  OPENAI_NOT_CONFIGURED_ERROR,
  summarizeChange,
} from "@/lib/ai/change-summary";
import { discoverCompetitorPages } from "@/lib/crawler/discovery";
import { scrapePages, type ScrapedPage } from "@/lib/crawler/scraper";
import { detectTextDiff } from "@/lib/diff-engine";
import { formatDatabaseError } from "@/lib/errors";
import {
  notificationForPage,
  sendChangeNotification,
  type ChangeNotificationContext,
} from "@/lib/notifications";
import { createDefaultMonitoredPages } from "@/lib/urls";

type Supabase = SupabaseClient<Database>;

type ScanResult = {
  checked: number;
  snapshotsCreated: number;
  changed: number;
  changesCreated: number;
  aiSummariesCreated: number;
  aiSummariesSkipped: number;
  aiSummaryFailures: number;
  notificationsSent: number;
  notificationsSkipped: number;
  failed: number;
  failures: Array<{
    url: string;
    error: string;
  }>;
  notificationFailures: Array<{
    url: string;
    error: string;
  }>;
};

type ScannerResult<T> = {
  data: T | null;
  error?: string;
};

function byRequestedUrl(scrapes: ScrapedPage[]) {
  return new Map(scrapes.map((scrape) => [scrape.requestedUrl, scrape]));
}

function scrapeFailureMessage(scrape: ScrapedPage | undefined) {
  if (!scrape) {
    return "No scrape result.";
  }

  if (scrape.error) {
    return scrape.error;
  }

  if (scrape.status && scrape.status >= 400) {
    return `HTTP ${scrape.status}`;
  }

  return "No meaningful text extracted.";
}

async function latestSnapshot(supabase: Supabase, monitoredPageId: string) {
  const { data, error } = await supabase
    .from("snapshots")
    .select("hash, raw_text")
    .eq("monitored_page_id", monitoredPageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function saveSnapshot(
  supabase: Supabase,
  monitoredPage: MonitoredPage,
  scrape: ScrapedPage,
  options?: { competitorName?: string },
) {
  const existingSnapshot = await latestSnapshot(supabase, monitoredPage.id);
  const snapshotCreated = existingSnapshot?.hash !== scrape.hash;
  const changed = Boolean(existingSnapshot && snapshotCreated);
  let changeCreated = false;
  let change: Pick<
    DetectedChange,
    "id" | "diff_summary" | "severity" | "created_at"
  > | null = null;
  let summarySource: "openai" | "heuristic" | null = null;
  let summaryError: string | null = null;

  if (snapshotCreated) {
    const { error: snapshotError } = await supabase.from("snapshots").insert({
      monitored_page_id: monitoredPage.id,
      raw_text: scrape.rawText,
      hash: scrape.hash,
    });

    if (snapshotError) {
      throw new Error(snapshotError.message);
    }

    if (existingSnapshot) {
      const diff = detectTextDiff({
        previousText: existingSnapshot.raw_text,
        nextText: scrape.rawText,
        pageType: monitoredPage.page_type,
      });

      if (diff.changed) {
        const summary = await summarizeChange({
          competitorName: options?.competitorName ?? "Tracked competitor",
          pageType: monitoredPage.page_type,
          pageUrl: monitoredPage.url,
          diff,
        });
        summarySource = summary.source;
        summaryError = summary.error ?? null;

        const { data: detectedChange, error: changeError } = await supabase
          .from("detected_changes")
          .insert({
            monitored_page_id: monitoredPage.id,
            diff_summary: `${summary.summary} ${summary.whyItMatters}`,
            severity: summary.severity,
          })
          .select("id, diff_summary, severity, created_at")
          .single();

        if (changeError) {
          throw new Error(changeError.message);
        }

        change = detectedChange;
        changeCreated = true;
      }
    }
  }

  const { error: updateError } = await supabase
    .from("monitored_pages")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", monitoredPage.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    snapshotCreated,
    changed,
    changeCreated,
    change,
    summarySource,
    summaryError,
  };
}

export async function createInitialMonitoringSetup(
  supabase: Supabase,
  competitorId: string,
  baseUrl: string,
  options?: { submittedPageUrl?: string },
): Promise<
  ScannerResult<{
    pagesCreated: number;
    snapshotsCreated: number;
    crawlWarning?: string;
  }>
> {
  let discoveredPages: Awaited<ReturnType<typeof discoverCompetitorPages>> = [];
  let crawlWarning: string | undefined;

  try {
    discoveredPages = await discoverCompetitorPages(baseUrl, {
      submittedPageUrl: options?.submittedPageUrl,
    });
  } catch (error) {
    crawlWarning =
      error instanceof Error ? error.message : "Could not crawl competitor.";
  }

  const discoveredByPageType = new Map(
    discoveredPages.map((page) => [page.pageType, page]),
  );
  const pagesToInsert = createDefaultMonitoredPages(
    competitorId,
    baseUrl,
  ).map((page) => ({
    ...page,
    url: discoveredByPageType.get(page.page_type)?.url ?? page.url,
  }));

  const { data: monitoredPages, error: pagesError } = await supabase
    .from("monitored_pages")
    .insert(pagesToInsert)
    .select("*");

  if (pagesError) {
    return { data: null, error: pagesError.message };
  }

  let snapshotsCreated = 0;

  for (const monitoredPage of monitoredPages ?? []) {
    const scrape = discoveredByPageType.get(monitoredPage.page_type)?.scrape;

    if (!scrape?.rawText) {
      continue;
    }

    try {
      const result = await saveSnapshot(supabase, monitoredPage, scrape);
      snapshotsCreated += result.snapshotCreated ? 1 : 0;
    } catch (error) {
      crawlWarning =
        error instanceof Error ? error.message : "Could not save snapshot.";
    }
  }

  return {
    data: {
      pagesCreated: monitoredPages?.length ?? 0,
      snapshotsCreated,
      crawlWarning,
    },
  };
}

export async function scanMonitoredPagesForUser(
  supabase: Supabase,
  userId: string,
): Promise<ScannerResult<ScanResult>> {
  const { data: competitors, error: competitorsError } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("user_id", userId);

  if (competitorsError) {
    return { data: null, error: formatDatabaseError(competitorsError.message) };
  }

  const competitorIds = (competitors ?? []).map((competitor) => competitor.id);

  if (!competitorIds.length) {
    return {
      data: {
        checked: 0,
        snapshotsCreated: 0,
        changed: 0,
        changesCreated: 0,
        aiSummariesCreated: 0,
        aiSummariesSkipped: 0,
        aiSummaryFailures: 0,
        notificationsSent: 0,
        notificationsSkipped: 0,
        failed: 0,
        failures: [],
        notificationFailures: [],
      },
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return { data: null, error: formatDatabaseError(profileError.message) };
  }

  const { data: monitoredPages, error: pagesError } = await supabase
    .from("monitored_pages")
    .select("*")
    .in("competitor_id", competitorIds);

  if (pagesError) {
    return { data: null, error: formatDatabaseError(pagesError.message) };
  }

  const pages = monitoredPages ?? [];
  const competitorById = new Map(
    (competitors ?? []).map((competitor) => [
      competitor.id,
      { name: competitor.name },
    ]),
  );
  const notificationContext: ChangeNotificationContext = {
    recipientEmail: profile?.email ?? null,
    competitorById,
  };
  const scrapes = await scrapePages(pages.map((page) => page.url));
  const scrapeByUrl = byRequestedUrl(scrapes);
  const result: ScanResult = {
    checked: 0,
    snapshotsCreated: 0,
    changed: 0,
    changesCreated: 0,
    aiSummariesCreated: 0,
    aiSummariesSkipped: 0,
    aiSummaryFailures: 0,
    notificationsSent: 0,
    notificationsSkipped: 0,
    failed: 0,
    failures: [],
    notificationFailures: [],
  };

  for (const monitoredPage of pages) {
    const scrape = scrapeByUrl.get(monitoredPage.url);

    if (!scrape || !scrape.ok) {
      result.failed += 1;
      result.failures.push({
        url: monitoredPage.url,
        error: scrapeFailureMessage(scrape),
      });
      continue;
    }

    try {
      const competitorName =
        competitorById.get(monitoredPage.competitor_id)?.name ??
        "Tracked competitor";
      const saved = await saveSnapshot(supabase, monitoredPage, scrape, {
        competitorName,
      });
      result.checked += 1;
      result.snapshotsCreated += saved.snapshotCreated ? 1 : 0;
      result.changed += saved.changed ? 1 : 0;
      result.changesCreated += saved.changeCreated ? 1 : 0;

      if (saved.changeCreated) {
        if (saved.summarySource === "openai") {
          result.aiSummariesCreated += 1;
        } else {
          result.aiSummariesSkipped += 1;
          result.aiSummaryFailures +=
            saved.summaryError &&
            saved.summaryError !== OPENAI_NOT_CONFIGURED_ERROR
              ? 1
              : 0;
        }
      }

      if (saved.change) {
        const notification = notificationForPage({
          context: notificationContext,
          monitoredPage,
          change: saved.change,
        });

        if (!notification) {
          result.notificationsSkipped += 1;
        } else {
          const notificationResult =
            await sendChangeNotification(notification);

          if (notificationResult.sent) {
            result.notificationsSent += 1;
          } else if (notificationResult.skipped) {
            result.notificationsSkipped += 1;
          } else {
            result.notificationFailures.push({
              url: monitoredPage.url,
              error: notificationResult.error ?? "Could not send email.",
            });
          }
        }
      }
    } catch (error) {
      result.failed += 1;
      result.failures.push({
        url: monitoredPage.url,
        error: error instanceof Error ? error.message : "Could not save scan.",
      });
    }
  }

  return { data: result };
}
