import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntelligenceSummaryResult } from "@/lib/ai/intelligence-summary";
import type { DiscoveredPage } from "@/lib/crawler/discovery";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type { Database, Json, MonitoredPage, ScanDebugLog } from "@/lib/database.types";
import type { PageIntelligence, StructuredFact } from "@/lib/intelligence/types";

type Supabase = SupabaseClient<Database>;

export type ScanDebugRunType =
  | "initial_setup"
  | "manual_analysis"
  | "manual_scan";

export type ScanDebugStatus = "success" | "partial" | "failed";

export type ScanDebugLogView = {
  id: string;
  runType: ScanDebugRunType;
  status: ScanDebugStatus;
  normalizedUrl: string | null;
  submittedUrl: string | null;
  payload: Json;
  warnings: string[];
  errors: string[];
  createdAt: string;
};

type SaveScanDebugLogInput = {
  supabase: Supabase;
  competitorId: string;
  runType: ScanDebugRunType;
  status: ScanDebugStatus;
  normalizedUrl?: string | null;
  submittedUrl?: string | null;
  payload: unknown;
  warnings?: string[];
  errors?: string[];
};

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function compactFact(fact: StructuredFact) {
  return {
    field: fact.field,
    value: fact.value,
    normalized_value: fact.normalized_value ?? null,
    confidence: fact.confidence,
    confidence_score: fact.confidence_score,
    source_url: fact.source_url,
    evidence_text: fact.evidence_text,
    extraction_method: fact.extraction_method,
  };
}

function compactScrape(scrape: ScrapedPage | null | undefined) {
  if (!scrape) {
    return null;
  }

  return {
    requested_url: scrape.requestedUrl,
    final_url: scrape.finalUrl,
    title: scrape.title,
    fetch_status: scrape.status,
    ok: scrape.ok,
    content_hash: scrape.hash,
    extracted_text_length: scrape.rawText.length,
    link_count: scrape.links.length,
    page_model: scrape.pageModel
      ? {
          block_count: scrape.pageModel.blocks.length,
          hero: scrape.pageModel.hero
            ? {
                heading: scrape.pageModel.hero.heading,
                type: scrape.pageModel.hero.type,
                confidence: scrape.pageModel.hero.confidence,
              }
            : null,
          pricing_block_count: scrape.pageModel.pricingBlocks.length,
          feature_block_count: scrape.pageModel.featureBlocks.length,
          cta_block_count: scrape.pageModel.ctaBlocks.length,
          changelog_block_count: scrape.pageModel.changelogBlocks.length,
        }
      : null,
    error: scrape.error ?? null,
  };
}

function compactPage(page: PageIntelligence) {
  return {
    source_url: page.sourceUrl,
    page_type: page.pageType,
    title: page.title,
    fetch_status: page.fetchStatus,
    content_hash: page.contentHash,
    extracted_text_length: page.extractedTextLength,
    pricing: {
      status: page.pricing.status,
      lowest_price: page.pricing.lowestPrice
        ? compactFact(page.pricing.lowestPrice)
        : null,
      contact_sales: page.pricing.contactSales
        ? compactFact(page.pricing.contactSales)
        : null,
      pricing_tier_count: page.pricing.pricingTierCount
        ? compactFact(page.pricing.pricingTierCount)
        : null,
      paid_price_count: page.pricing.paidPlans.length,
      plan_names: page.pricing.planNames.map(compactFact),
      debug: page.pricing.debug,
      warnings: page.pricing.warnings,
    },
    positioning: {
      status: page.positioning.status,
      homepage_headline: page.positioning.homepageHeadline
        ? compactFact(page.positioning.homepageHeadline)
        : null,
      subheadline: page.positioning.subheadline
        ? compactFact(page.positioning.subheadline)
        : null,
      product_category: page.positioning.productCategory
        ? compactFact(page.positioning.productCategory)
        : null,
      target_customer: page.positioning.targetCustomer
        ? compactFact(page.positioning.targetCustomer)
        : null,
      main_value_prop: page.positioning.mainValueProp
        ? compactFact(page.positioning.mainValueProp)
        : null,
      key_use_case: page.positioning.keyUseCase
        ? compactFact(page.positioning.keyUseCase)
        : null,
      warnings: page.positioning.warnings,
    },
    ctas: {
      status: page.ctas.status,
      primary_cta: page.ctas.primaryCta
        ? compactFact(page.ctas.primaryCta)
        : null,
      secondary_cta: page.ctas.secondaryCta
        ? compactFact(page.ctas.secondaryCta)
        : null,
      ctas: page.ctas.ctas.map(compactFact),
      warnings: page.ctas.warnings,
    },
    features: {
      status: page.features.status,
      features: page.features.features.map(compactFact),
      warnings: page.features.warnings,
    },
    changelog: {
      status: page.changelog.status,
      changelog_url: page.changelog.changelogUrl,
      changelog_detected: page.changelog.changelogDetected
        ? compactFact(page.changelog.changelogDetected)
        : null,
      last_visible_update_date: page.changelog.lastVisibleUpdateDate
        ? compactFact(page.changelog.lastVisibleUpdateDate)
        : null,
      recent_update_titles: page.changelog.recentUpdateTitles.map(compactFact),
      confidence: page.changelog.confidence,
      evidence_text: page.changelog.evidenceText,
      warnings: page.changelog.warnings,
    },
    fact_count: page.facts.length,
    facts: page.facts.slice(0, 60).map(compactFact),
    warnings: page.warnings,
  };
}

function compactMonitoredPage(page: MonitoredPage) {
  return {
    id: page.id,
    url: page.url,
    page_type: page.page_type,
    last_checked_at: page.last_checked_at,
  };
}

function compactDiscoveredPage(page: DiscoveredPage) {
  return {
    url: page.url,
    page_type: page.pageType,
    candidate_page_type: page.candidatePageType,
    title: page.title,
    relevance_score: page.relevanceScore,
    fetch_status: page.fetchStatus,
    content_hash: page.contentHash,
    extracted_text_length: page.extractedTextLength,
    source: page.source,
    scrape: compactScrape(page.scrape),
  };
}

function compactSummary(summary: IntelligenceSummaryResult) {
  return {
    executive_summary: summary.executive_summary,
    pricing_summary: summary.pricing_summary,
    positioning_summary: summary.positioning_summary,
    feature_summary: summary.feature_summary,
    cta_summary: summary.cta_summary,
    unknowns: summary.unknowns,
    warnings: summary.warnings,
    overall_confidence: summary.overall_confidence,
    source: summary.source,
    error: summary.error ?? null,
  };
}

export function buildInitialSetupDebugPayload({
  baseUrl,
  submittedPageUrl,
  discoveredPages,
  monitoredPages,
  intelligencePages,
  summary,
  result,
}: {
  baseUrl: string;
  submittedPageUrl?: string;
  discoveredPages: DiscoveredPage[];
  monitoredPages: MonitoredPage[];
  intelligencePages: PageIntelligence[];
  summary: IntelligenceSummaryResult | null;
  result: {
    pagesCreated: number;
    snapshotsCreated: number;
    intelligenceSnapshotCreated: boolean;
  };
}) {
  return {
    normalized_url: baseUrl,
    submitted_url: submittedPageUrl ?? null,
    homepage_fetch:
      discoveredPages.find((page) => page.pageType === "homepage")?.scrape
        ? compactScrape(
            discoveredPages.find((page) => page.pageType === "homepage")
              ?.scrape,
          )
        : null,
    selected_pages: discoveredPages.map(compactDiscoveredPage),
    monitored_pages: monitoredPages.map(compactMonitoredPage),
    extraction: {
      analyzed_pages: intelligencePages.map(compactPage),
      facts: intelligencePages.flatMap((page) => page.facts).map(compactFact),
      warnings: unique(intelligencePages.flatMap((page) => page.warnings)),
    },
    ai: summary
      ? {
          input: {
            analyzed_page_count: intelligencePages.length,
            fact_count: intelligencePages.flatMap((page) => page.facts).length,
            facts: intelligencePages
              .flatMap((page) => page.facts)
              .slice(0, 80)
              .map(compactFact),
          },
          output: compactSummary(summary),
        }
      : null,
    result,
  };
}

export function buildManualAnalysisDebugPayload({
  monitoredPages,
  scrapes,
  intelligencePages,
  summary,
  result,
}: {
  monitoredPages: MonitoredPage[];
  scrapes: ScrapedPage[];
  intelligencePages: PageIntelligence[];
  summary: IntelligenceSummaryResult | null;
  result: {
    pagesAnalyzed: number;
    intelligenceSnapshotCreated: boolean;
    baselineSnapshotsCreated: number;
    failed: number;
  };
}) {
  return {
    monitored_pages: monitoredPages.map(compactMonitoredPage),
    page_fetches: scrapes.map(compactScrape),
    selected_pages: intelligencePages.map((page) => ({
      url: page.sourceUrl,
      page_type: page.pageType,
      title: page.title,
      fetch_status: page.fetchStatus,
      content_hash: page.contentHash,
      extracted_text_length: page.extractedTextLength,
    })),
    extraction: {
      analyzed_pages: intelligencePages.map(compactPage),
      facts: intelligencePages.flatMap((page) => page.facts).map(compactFact),
      warnings: unique(intelligencePages.flatMap((page) => page.warnings)),
    },
    ai: summary
      ? {
          input: {
            analyzed_page_count: intelligencePages.length,
            fact_count: intelligencePages.flatMap((page) => page.facts).length,
            facts: intelligencePages
              .flatMap((page) => page.facts)
              .slice(0, 80)
              .map(compactFact),
          },
          output: compactSummary(summary),
        }
      : null,
    result,
  };
}

export function buildManualScanDebugPayload({
  pages,
  scrapes,
  outcomes,
}: {
  pages: MonitoredPage[];
  scrapes: ScrapedPage[];
  outcomes: unknown[];
}) {
  return {
    monitored_pages: pages.map(compactMonitoredPage),
    page_fetches: scrapes.map(compactScrape),
    outcomes,
  };
}

export async function saveScanDebugLog({
  supabase,
  competitorId,
  runType,
  status,
  normalizedUrl,
  submittedUrl,
  payload,
  warnings = [],
  errors = [],
}: SaveScanDebugLogInput) {
  try {
    const { error } = await supabase.from("scan_debug_logs").insert({
      competitor_id: competitorId,
      run_type: runType,
      status,
      normalized_url: normalizedUrl ?? null,
      submitted_url: submittedUrl ?? null,
      payload: toJson(payload),
      warnings: unique(warnings),
      errors: unique(errors),
    });

    return error?.message ?? null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Could not save scan debug log.";
  }
}

export function parseScanDebugLog(row: ScanDebugLog): ScanDebugLogView {
  return {
    id: row.id,
    runType: row.run_type,
    status: row.status,
    normalizedUrl: row.normalized_url,
    submittedUrl: row.submitted_url,
    payload: row.payload,
    warnings: row.warnings,
    errors: row.errors,
    createdAt: row.created_at,
  };
}
