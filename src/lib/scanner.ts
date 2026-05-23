import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  DetectedChange,
  MonitoredPage,
  PageType,
} from "@/lib/database.types";
import { summarizeIntelligence } from "@/lib/ai/intelligence-summary";
import {
  buildSnapshotAnalysis,
  buildUnavailableSnapshotAnalysis,
  compareSnapshotAnalyses,
  createDetectedChangePayload,
  normalizeForChangeDetection,
  parseSnapshotFacts,
  snapshotFactsToJson,
  type MeaningfulChange,
  type SnapshotAnalysis,
  type SnapshotComparison,
  type SnapshotFacts,
} from "@/lib/change-detection";
import { discoverCompetitorPages } from "@/lib/crawler/discovery";
import { scrapePages, type ScrapedPage } from "@/lib/crawler/scraper";
import { formatDatabaseError } from "@/lib/errors";
import { analyzePageIntelligence } from "@/lib/intelligence/analyze";
import type { PageIntelligence } from "@/lib/intelligence/types";
import {
  saveCompetitorIntelligenceSnapshot,
  updateCompetitorScanStatus,
} from "@/lib/intelligence/persistence";
import {
  buildInitialSetupDebugPayload,
  buildManualAnalysisDebugPayload,
  buildManualScanDebugPayload,
  saveScanDebugLog,
} from "@/lib/scan-debug";
import { cleanupSnapshotRetentionForUser } from "@/lib/retention";
import {
  notificationForPage,
  sendChangeNotification,
  type ChangeNotificationContext,
} from "@/lib/notifications";
import {
  estimateScanCostEur,
  recordUsageEvent,
  type UsageEventType,
} from "@/lib/usage";
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
  deferred: number;
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

type ManualScanDebugOutcome = {
  url: string;
  page_type: PageType;
  fetch_status: number | null;
  ok: boolean;
  snapshot_created?: boolean;
  raw_changed?: boolean;
  canonical_changed?: boolean;
  structured_facts_changed?: boolean;
  changed?: boolean;
  change_created?: boolean;
  summary_source?: "openai" | "heuristic" | null;
  summary_error?: string | null;
  ignored_reasons?: string[];
  meaningful_changes?: MeaningfulChange[];
  notification_sent?: boolean;
  notification_skipped?: boolean;
  error?: string;
};

function byRequestedUrl(scrapes: ScrapedPage[]) {
  return new Map(scrapes.map((scrape) => [scrape.requestedUrl, scrape]));
}

function scrapeFailureMessage(scrape: ScrapedPage | undefined) {
  if (!scrape) {
    return "No scrape result.";
  }

  if (scrape.javascriptHeavy) {
    return "This site appears JavaScript-heavy. Static analysis was limited.";
  }

  if (scrape.error) {
    return scrape.error;
  }

  if (scrape.status && scrape.status >= 400) {
    return `HTTP ${scrape.status}`;
  }

  return "No meaningful text extracted.";
}

function isOptionalIntelligencePersistenceError(error: string | null) {
  return Boolean(
    error &&
      /competitor_intelligence_snapshots|scan_status|last_scan_at|last_scan_error|schema cache/i.test(
        error,
      ),
  );
}

async function latestSnapshot(supabase: Supabase, monitoredPageId: string) {
  const { data, error } = await supabase
    .from("snapshots")
    .select(
      "hash, raw_text, raw_content_hash, canonical_content_hash, structured_facts_hash, structured_facts_json",
    )
    .eq("monitored_page_id", monitoredPageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

function previousSnapshotState(
  monitoredPage: MonitoredPage,
  existingSnapshot: NonNullable<Awaited<ReturnType<typeof latestSnapshot>>>,
) {
  const legacyScrape: ScrapedPage = {
    requestedUrl: monitoredPage.url,
    finalUrl: monitoredPage.url,
    title: "",
    metaDescription: "",
    status: 200,
    ok: true,
    rawText: existingSnapshot.raw_text,
    hash: existingSnapshot.hash,
    links: [],
  };
  const legacyAnalysis = buildSnapshotAnalysis({
    pageType: monitoredPage.page_type,
    scrape: legacyScrape,
  });
  const parsedFacts = parseSnapshotFacts(
    existingSnapshot.structured_facts_json,
  );

  return {
    rawHash:
      existingSnapshot.raw_content_hash ??
      existingSnapshot.hash ??
      legacyAnalysis.rawContentHash,
    canonicalHash:
      existingSnapshot.canonical_content_hash ??
      legacyAnalysis.canonicalContentHash,
    structuredFactsHash:
      existingSnapshot.structured_facts_hash ??
      legacyAnalysis.structuredFactsHash,
    facts: parsedFacts ?? legacyAnalysis.structuredFacts,
    canonicalContent: normalizeForChangeDetection(existingSnapshot.raw_text),
  };
}

async function saveAnalyzedSnapshot(
  supabase: Supabase,
  monitoredPage: MonitoredPage,
  current: SnapshotAnalysis,
) {
  const existingSnapshot = await latestSnapshot(supabase, monitoredPage.id);
  let comparison: SnapshotComparison | null = null;
  let previousFacts: SnapshotFacts | null = null;

  if (existingSnapshot) {
    const previous = previousSnapshotState(monitoredPage, existingSnapshot);
    previousFacts = previous.facts;
    comparison = compareSnapshotAnalyses({
      previousRawHash: previous.rawHash,
      previousCanonicalHash: previous.canonicalHash,
      previousStructuredFactsHash: previous.structuredFactsHash,
      previousFacts,
      previousCanonicalContent: previous.canonicalContent,
      current,
    });
  }

  const snapshotCreated = Boolean(
    !existingSnapshot ||
      comparison?.canonicalChanged ||
      comparison?.structuredFactsChanged,
  );
  const meaningfulChanges = comparison?.meaningfulChanges ?? [];
  const changed = meaningfulChanges.length > 0;
  let changeCreated = false;
  let change: Pick<
    DetectedChange,
    "id" | "diff_summary" | "severity" | "created_at"
  > | null = null;
  let summarySource: "openai" | "heuristic" | null = null;
  const summaryError: string | null = null;

  if (changed) {
    summarySource = "heuristic";
  }

  if (snapshotCreated) {
    const { error: snapshotError } = await supabase.from("snapshots").insert({
      monitored_page_id: monitoredPage.id,
      raw_text: current.rawText,
      hash: current.rawContentHash,
      raw_content_hash: current.rawContentHash,
      canonical_content_hash: current.canonicalContentHash,
      structured_facts_hash: current.structuredFactsHash,
      structured_facts_json: snapshotFactsToJson(current.structuredFacts),
    });

    if (snapshotError) {
      throw new Error(snapshotError.message);
    }
  }

  const detectedChangePayload = createDetectedChangePayload(meaningfulChanges);

  if (existingSnapshot && detectedChangePayload) {
    const { data: detectedChange, error: changeError } = await supabase
      .from("detected_changes")
      .insert({
        monitored_page_id: monitoredPage.id,
        ...detectedChangePayload,
      })
      .select("id, diff_summary, severity, created_at")
      .single();

    if (changeError) {
      throw new Error(changeError.message);
    }

    change = detectedChange;
    changeCreated = true;
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
    rawChanged: comparison?.rawChanged ?? false,
    canonicalChanged: comparison?.canonicalChanged ?? false,
    structuredFactsChanged: comparison?.structuredFactsChanged ?? false,
    ignoredReasons: comparison?.ignoredReasons ?? [],
    meaningfulChanges,
  };
}

async function saveSnapshot(
  supabase: Supabase,
  monitoredPage: MonitoredPage,
  scrape: ScrapedPage,
) {
  return saveAnalyzedSnapshot(
    supabase,
    monitoredPage,
    buildSnapshotAnalysis({ pageType: monitoredPage.page_type, scrape }),
  );
}

async function saveUnavailableSnapshot(
  supabase: Supabase,
  monitoredPage: MonitoredPage,
  scrape: ScrapedPage,
) {
  return saveAnalyzedSnapshot(
    supabase,
    monitoredPage,
    buildUnavailableSnapshotAnalysis({
      pageType: monitoredPage.page_type,
      scrape,
    }),
  );
}

async function saveBaselineSnapshot(
  supabase: Supabase,
  monitoredPage: MonitoredPage,
  scrape: ScrapedPage,
) {
  const existingSnapshot = await latestSnapshot(supabase, monitoredPage.id);
  const analysis = buildSnapshotAnalysis({
    pageType: monitoredPage.page_type,
    scrape,
  });
  const previous = existingSnapshot
    ? previousSnapshotState(monitoredPage, existingSnapshot)
    : null;
  const snapshotCreated = Boolean(
    !existingSnapshot ||
      previous?.canonicalHash !== analysis.canonicalContentHash ||
      previous?.structuredFactsHash !== analysis.structuredFactsHash,
  );

  if (snapshotCreated) {
    const { error: snapshotError } = await supabase.from("snapshots").insert({
      monitored_page_id: monitoredPage.id,
      raw_text: analysis.rawText,
      hash: analysis.rawContentHash,
      raw_content_hash: analysis.rawContentHash,
      canonical_content_hash: analysis.canonicalContentHash,
      structured_facts_hash: analysis.structuredFactsHash,
      structured_facts_json: snapshotFactsToJson(analysis.structuredFacts),
    });

    if (snapshotError) {
      throw new Error(snapshotError.message);
    }
  }

  const { error: updateError } = await supabase
    .from("monitored_pages")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", monitoredPage.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { snapshotCreated };
}

export async function createInitialMonitoringSetup(
  supabase: Supabase,
  competitorId: string,
  baseUrl: string,
  options?: {
    competitorName?: string;
    submittedPageUrl?: string;
    userId?: string;
  },
): Promise<
  ScannerResult<{
    pagesCreated: number;
    snapshotsCreated: number;
    intelligenceSnapshotCreated: boolean;
    crawlWarning?: string;
  }>
> {
  let discoveredPages: Awaited<ReturnType<typeof discoverCompetitorPages>> = [];
  let crawlWarning: string | undefined;

  await updateCompetitorScanStatus({
    supabase,
    competitorId,
    status: "running",
  });

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
    await updateCompetitorScanStatus({
      supabase,
      competitorId,
      status: "failed",
      error: pagesError.message,
    });
    await saveScanDebugLog({
      supabase,
      competitorId,
      runType: "initial_setup",
      status: "failed",
      normalizedUrl: baseUrl,
      submittedUrl: options?.submittedPageUrl ?? null,
      payload: buildInitialSetupDebugPayload({
        baseUrl,
        submittedPageUrl: options?.submittedPageUrl,
        discoveredPages,
        monitoredPages: [],
        intelligencePages: [],
        summary: null,
        result: {
          pagesCreated: 0,
          snapshotsCreated: 0,
          intelligenceSnapshotCreated: false,
        },
      }),
      warnings: crawlWarning ? [crawlWarning] : [],
      errors: [pagesError.message],
    });

    return { data: null, error: pagesError.message };
  }

  let snapshotsCreated = 0;
  let intelligenceSnapshotCreated = false;

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

  const intelligencePages = discoveredPages
    .filter((page) => page.scrape.ok && page.scrape.rawText)
    .map((page) =>
      analyzePageIntelligence({
        pageType: page.pageType,
        scrape: page.scrape,
      }),
    );
  const intelligenceSummary = await summarizeIntelligence({
    competitorName: options?.competitorName ?? "Tracked competitor",
    pages: intelligencePages,
    supabase,
    userId: options?.userId,
  });
  const intelligenceError = await saveCompetitorIntelligenceSnapshot({
    supabase,
    competitorId,
    pages: intelligencePages,
    summary: intelligenceSummary,
  });

  intelligenceSnapshotCreated = !intelligenceError;

  if (
    intelligenceError &&
    !isOptionalIntelligencePersistenceError(intelligenceError) &&
    !crawlWarning
  ) {
    crawlWarning = intelligenceError;
  }

  const firstScanFailed = snapshotsCreated === 0 && intelligencePages.length === 0;
  await updateCompetitorScanStatus({
    supabase,
    competitorId,
    status: firstScanFailed ? "failed" : "ready",
    error: firstScanFailed
      ? crawlWarning ?? "No useful public pages found."
      : null,
  });
  await saveScanDebugLog({
    supabase,
    competitorId,
    runType: "initial_setup",
    status: firstScanFailed
      ? "failed"
      : crawlWarning || intelligenceError
        ? "partial"
        : "success",
    normalizedUrl: baseUrl,
    submittedUrl: options?.submittedPageUrl ?? null,
    payload: buildInitialSetupDebugPayload({
      baseUrl,
      submittedPageUrl: options?.submittedPageUrl,
      discoveredPages,
      monitoredPages: monitoredPages ?? [],
      intelligencePages,
      summary: intelligenceSummary,
      result: {
        pagesCreated: monitoredPages?.length ?? 0,
        snapshotsCreated,
        intelligenceSnapshotCreated,
      },
    }),
    warnings: [
      ...(crawlWarning ? [crawlWarning] : []),
      ...intelligencePages.flatMap((page) => page.warnings),
      ...intelligenceSummary.warnings,
      ...intelligenceSummary.unknowns,
    ],
    errors:
      firstScanFailed || intelligenceError
        ? [crawlWarning, intelligenceError, firstScanFailed ? "No useful public pages found." : null].filter(
            (value): value is string => Boolean(value),
          )
        : [],
  });

  if (options?.userId) {
    await cleanupSnapshotRetentionForUser({
      supabase,
      userId: options.userId,
    });

    await recordUsageEvent({
      supabase,
      userId: options.userId,
      eventType: "competitor_initial_scan",
      quantity: intelligencePages.length,
      estimatedCostEur: estimateScanCostEur(intelligencePages.length),
      metadata: {
        competitor_id: competitorId,
        pages_analyzed: intelligencePages.length,
        snapshots_created: snapshotsCreated,
      },
    });
  }

  return {
    data: {
      pagesCreated: monitoredPages?.length ?? 0,
      snapshotsCreated,
      intelligenceSnapshotCreated,
      crawlWarning,
    },
  };
}

export async function rerunCompetitorIntelligence(
  supabase: Supabase,
  {
    competitorId,
    competitorName,
    userId,
    baselinePageIds = [],
  }: {
    competitorId: string;
    competitorName: string;
    userId?: string;
    baselinePageIds?: string[];
  },
): Promise<
  ScannerResult<{
    pagesAnalyzed: number;
    intelligenceSnapshotCreated: boolean;
    baselineSnapshotsCreated: number;
    failed: number;
    warnings: string[];
  }>
> {
  await updateCompetitorScanStatus({
    supabase,
    competitorId,
    status: "running",
  });

  const { data: monitoredPages, error: pagesError } = await supabase
    .from("monitored_pages")
    .select("*")
    .eq("competitor_id", competitorId);

  if (pagesError) {
    await updateCompetitorScanStatus({
      supabase,
      competitorId,
      status: "failed",
      error: pagesError.message,
    });
    await saveScanDebugLog({
      supabase,
      competitorId,
      runType: "manual_analysis",
      status: "failed",
      payload: buildManualAnalysisDebugPayload({
        monitoredPages: [],
        scrapes: [],
        intelligencePages: [],
        summary: null,
        result: {
          pagesAnalyzed: 0,
          intelligenceSnapshotCreated: false,
          baselineSnapshotsCreated: 0,
          failed: 1,
        },
      }),
      errors: [pagesError.message],
    });

    return { data: null, error: pagesError.message };
  }

  const pages = monitoredPages ?? [];

  if (!pages.length) {
    const error = "No monitored pages found.";

    await updateCompetitorScanStatus({
      supabase,
      competitorId,
      status: "failed",
      error,
    });
    await saveScanDebugLog({
      supabase,
      competitorId,
      runType: "manual_analysis",
      status: "failed",
      payload: buildManualAnalysisDebugPayload({
        monitoredPages: [],
        scrapes: [],
        intelligencePages: [],
        summary: null,
        result: {
          pagesAnalyzed: 0,
          intelligenceSnapshotCreated: false,
          baselineSnapshotsCreated: 0,
          failed: 1,
        },
      }),
      errors: [error],
    });

    return { data: null, error };
  }

  const baselinePageIdSet = new Set(baselinePageIds);
  const scrapes = await scrapePages(pages.map((page) => page.url));
  const scrapeByUrl = byRequestedUrl(scrapes);
  const intelligencePages: PageIntelligence[] = [];
  let baselineSnapshotsCreated = 0;
  let failed = 0;
  const warnings: string[] = [];

  for (const page of pages) {
    const scrape = scrapeByUrl.get(page.url);

    if (!scrape || !scrape.ok) {
      failed += 1;
      warnings.push(`${page.url}: ${scrapeFailureMessage(scrape)}`);
      continue;
    }

    intelligencePages.push(
      analyzePageIntelligence({
        pageType: page.page_type as PageType,
        scrape,
      }),
    );

    if (baselinePageIdSet.has(page.id)) {
      try {
        const baseline = await saveBaselineSnapshot(supabase, page, scrape);
        baselineSnapshotsCreated += baseline.snapshotCreated ? 1 : 0;
      } catch (error) {
        failed += 1;
        warnings.push(
          error instanceof Error ? error.message : "Could not save baseline.",
        );
      }
    }
  }

  if (!intelligencePages.length) {
    const error = warnings[0] ?? "No useful public pages found.";

    await updateCompetitorScanStatus({
      supabase,
      competitorId,
      status: "failed",
      error,
    });
    await saveScanDebugLog({
      supabase,
      competitorId,
      runType: "manual_analysis",
      status: "failed",
      payload: buildManualAnalysisDebugPayload({
        monitoredPages: pages,
        scrapes,
        intelligencePages,
        summary: null,
        result: {
          pagesAnalyzed: 0,
          intelligenceSnapshotCreated: false,
          baselineSnapshotsCreated,
          failed,
        },
      }),
      warnings,
      errors: [error],
    });

    return { data: null, error };
  }

  const intelligenceSummary = await summarizeIntelligence({
    competitorName,
    pages: intelligencePages,
    supabase,
    userId,
  });
  const intelligenceError = await saveCompetitorIntelligenceSnapshot({
    supabase,
    competitorId,
    pages: intelligencePages,
    summary: intelligenceSummary,
  });
  const intelligenceSnapshotCreated = !intelligenceError;

  if (
    intelligenceError &&
    !isOptionalIntelligencePersistenceError(intelligenceError)
  ) {
    await updateCompetitorScanStatus({
      supabase,
      competitorId,
      status: "failed",
      error: intelligenceError,
    });
    await saveScanDebugLog({
      supabase,
      competitorId,
      runType: "manual_analysis",
      status: "failed",
      payload: buildManualAnalysisDebugPayload({
        monitoredPages: pages,
        scrapes,
        intelligencePages,
        summary: intelligenceSummary,
        result: {
          pagesAnalyzed: intelligencePages.length,
          intelligenceSnapshotCreated,
          baselineSnapshotsCreated,
          failed,
        },
      }),
      warnings: [
        ...warnings,
        ...intelligencePages.flatMap((page) => page.warnings),
        ...intelligenceSummary.warnings,
        ...intelligenceSummary.unknowns,
      ],
      errors: [intelligenceError],
    });

    return { data: null, error: intelligenceError };
  }

  await updateCompetitorScanStatus({
    supabase,
    competitorId,
    status: "ready",
  });
  await saveScanDebugLog({
    supabase,
    competitorId,
    runType: "manual_analysis",
    status: failed || warnings.length ? "partial" : "success",
    payload: buildManualAnalysisDebugPayload({
      monitoredPages: pages,
      scrapes,
      intelligencePages,
      summary: intelligenceSummary,
      result: {
        pagesAnalyzed: intelligencePages.length,
        intelligenceSnapshotCreated,
        baselineSnapshotsCreated,
        failed,
      },
    }),
    warnings: [
      ...warnings,
      ...intelligencePages.flatMap((page) => page.warnings),
      ...intelligenceSummary.warnings,
      ...intelligenceSummary.unknowns,
    ],
  });

  if (userId) {
    await cleanupSnapshotRetentionForUser({
      supabase,
      userId,
    });

    await recordUsageEvent({
      supabase,
      userId,
      eventType: "manual_analysis",
      quantity: intelligencePages.length,
      estimatedCostEur: estimateScanCostEur(intelligencePages.length),
      metadata: {
        competitor_id: competitorId,
        pages_analyzed: intelligencePages.length,
        baseline_snapshots_created: baselineSnapshotsCreated,
      },
    });
  }

  return {
    data: {
      pagesAnalyzed: intelligencePages.length,
      intelligenceSnapshotCreated,
      baselineSnapshotsCreated,
      failed,
      warnings,
    },
  };
}

export async function scanMonitoredPagesForUser(
  supabase: Supabase,
  userId: string,
  options: {
    usageEventType?: Extract<UsageEventType, "manual_scan" | "scheduled_scan">;
    recordZeroUsage?: boolean;
  } = {},
): Promise<ScannerResult<ScanResult>> {
  const { data: competitors, error: competitorsError } = await supabase
    .from("competitors")
    .select("id, name, base_url")
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
        deferred: 0,
        failures: [],
        notificationFailures: [],
      },
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("email, scan_interval_hours")
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

  const allPages = monitoredPages ?? [];
  const minimumCheckedAt = Date.now() - (profile?.scan_interval_hours ?? 24) * 60 * 60 * 1000;
  const pages = allPages.filter((page) => {
    if (!page.last_checked_at) {
      return true;
    }

    return new Date(page.last_checked_at).getTime() <= minimumCheckedAt;
  });
  const competitorById = new Map(
    (competitors ?? []).map((competitor) => [
      competitor.id,
      { name: competitor.name, baseUrl: competitor.base_url },
    ]),
  );
  const notificationContext: ChangeNotificationContext = {
    recipientEmail: profile?.email ?? null,
    competitorById,
  };
  const scrapes = await scrapePages(pages.map((page) => page.url));
  const scrapeByUrl = byRequestedUrl(scrapes);
  const scanOutcomesByCompetitor = new Map<string, ManualScanDebugOutcome[]>();
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
    deferred: allPages.length - pages.length,
    failures: [],
    notificationFailures: [],
  };

  function addScanOutcome(
    competitorId: string,
    outcome: ManualScanDebugOutcome,
  ) {
    const outcomes = scanOutcomesByCompetitor.get(competitorId) ?? [];
    outcomes.push(outcome);
    scanOutcomesByCompetitor.set(competitorId, outcomes);
  }

  for (const monitoredPage of pages) {
    const scrape = scrapeByUrl.get(monitoredPage.url);

    if (!scrape || !scrape.ok) {
      const error = scrapeFailureMessage(scrape);
      result.failed += 1;
      result.failures.push({
        url: monitoredPage.url,
        error,
      });
      const outcome: ManualScanDebugOutcome = {
        url: monitoredPage.url,
        page_type: monitoredPage.page_type,
        fetch_status: scrape?.status ?? null,
        ok: false,
        error,
      };

      if (scrape) {
        try {
          const saved = await saveUnavailableSnapshot(
            supabase,
            monitoredPage,
            scrape,
          );

          result.checked += 1;
          result.snapshotsCreated += saved.snapshotCreated ? 1 : 0;
          result.changed += saved.changed ? 1 : 0;
          result.changesCreated += saved.changeCreated ? 1 : 0;
          outcome.snapshot_created = saved.snapshotCreated;
          outcome.raw_changed = saved.rawChanged;
          outcome.canonical_changed = saved.canonicalChanged;
          outcome.structured_facts_changed = saved.structuredFactsChanged;
          outcome.changed = saved.changed;
          outcome.change_created = saved.changeCreated;
          outcome.summary_source = saved.summarySource;
          outcome.summary_error = saved.summaryError;
          outcome.ignored_reasons = saved.ignoredReasons;
          outcome.meaningful_changes = saved.meaningfulChanges;

          if (saved.change) {
            const notification = notificationForPage({
              context: notificationContext,
              monitoredPage,
              change: saved.change,
            });

            if (!notification) {
              result.notificationsSkipped += 1;
              outcome.notification_skipped = true;
            } else {
              const notificationResult =
                await sendChangeNotification(notification);

              if (notificationResult.sent) {
                result.notificationsSent += 1;
                outcome.notification_sent = true;
              } else if (notificationResult.skipped) {
                result.notificationsSkipped += 1;
                outcome.notification_skipped = true;
              } else {
                outcome.error =
                  notificationResult.error ?? "Could not send email.";
                result.notificationFailures.push({
                  url: monitoredPage.url,
                  error: notificationResult.error ?? "Could not send email.",
                });
              }
            }
          }
        } catch (saveError) {
          outcome.error =
            saveError instanceof Error
              ? saveError.message
              : "Could not save unavailable page snapshot.";
        }
      }

      addScanOutcome(monitoredPage.competitor_id, outcome);
      continue;
    }

    try {
      const saved = await saveSnapshot(supabase, monitoredPage, scrape);
      result.checked += 1;
      result.snapshotsCreated += saved.snapshotCreated ? 1 : 0;
      result.changed += saved.changed ? 1 : 0;
      result.changesCreated += saved.changeCreated ? 1 : 0;
      const outcome: ManualScanDebugOutcome = {
        url: monitoredPage.url,
        page_type: monitoredPage.page_type,
        fetch_status: scrape.status,
        ok: true,
        snapshot_created: saved.snapshotCreated,
        raw_changed: saved.rawChanged,
        canonical_changed: saved.canonicalChanged,
        structured_facts_changed: saved.structuredFactsChanged,
        changed: saved.changed,
        change_created: saved.changeCreated,
        summary_source: saved.summarySource,
        summary_error: saved.summaryError,
        ignored_reasons: saved.ignoredReasons,
        meaningful_changes: saved.meaningfulChanges,
      };

      if (saved.changeCreated) {
        result.aiSummariesSkipped += 1;
        result.aiSummaryFailures += saved.summaryError ? 1 : 0;
      }

      if (saved.change) {
        const notification = notificationForPage({
          context: notificationContext,
          monitoredPage,
          change: saved.change,
        });

        if (!notification) {
          result.notificationsSkipped += 1;
          outcome.notification_skipped = true;
        } else {
          const notificationResult =
            await sendChangeNotification(notification);

          if (notificationResult.sent) {
            result.notificationsSent += 1;
            outcome.notification_sent = true;
          } else if (notificationResult.skipped) {
            result.notificationsSkipped += 1;
            outcome.notification_skipped = true;
          } else {
            outcome.error =
              notificationResult.error ?? "Could not send email.";
            result.notificationFailures.push({
              url: monitoredPage.url,
              error: notificationResult.error ?? "Could not send email.",
            });
          }
        }
      }

      addScanOutcome(monitoredPage.competitor_id, outcome);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save scan.";
      result.failed += 1;
      result.failures.push({
        url: monitoredPage.url,
        error: message,
      });
      addScanOutcome(monitoredPage.competitor_id, {
        url: monitoredPage.url,
        page_type: monitoredPage.page_type,
        fetch_status: scrape.status,
        ok: false,
        error: message,
      });
    }
  }

  for (const competitorId of competitorIds) {
    const competitor = competitorById.get(competitorId);
    const competitorPages = pages.filter(
      (page) => page.competitor_id === competitorId,
    );
    const pageUrls = new Set(competitorPages.map((page) => page.url));
    const competitorScrapes = scrapes.filter((scrape) =>
      pageUrls.has(scrape.requestedUrl),
    );
    const outcomes = scanOutcomesByCompetitor.get(competitorId) ?? [];
    const errors = outcomes
      .map((outcome) => outcome.error)
      .filter((value): value is string => Boolean(value));
    const successCount = outcomes.filter((outcome) => outcome.ok).length;
    const status: "success" | "partial" | "failed" =
      errors.length && successCount
        ? "partial"
        : errors.length
          ? "failed"
          : "success";

    await saveScanDebugLog({
      supabase,
      competitorId,
      runType: "manual_scan",
      status,
      normalizedUrl: competitor?.baseUrl ?? null,
      payload: buildManualScanDebugPayload({
        pages: competitorPages,
        scrapes: competitorScrapes,
        outcomes,
      }),
      warnings: errors,
      errors,
    });
  }

  await cleanupSnapshotRetentionForUser({
    supabase,
    userId,
  });

  const usageQuantity = result.checked + result.failed;

  if (usageQuantity > 0 || options.recordZeroUsage !== false) {
    await recordUsageEvent({
      supabase,
      userId,
      eventType: options.usageEventType ?? "manual_scan",
      quantity: usageQuantity,
      estimatedCostEur: estimateScanCostEur(usageQuantity),
      metadata: {
        checked: result.checked,
        failed: result.failed,
        deferred: result.deferred,
        changes_created: result.changesCreated,
      },
    });
  }

  return { data: result };
}
