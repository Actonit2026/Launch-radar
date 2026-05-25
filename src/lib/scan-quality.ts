import type { ScrapedPage } from "@/lib/crawler/scraper";
import type { PageIntelligence, StructuredFact } from "@/lib/intelligence/types";

export type ScanCompletenessStatus = "complete" | "partial" | "limited";
export type ScanQualityLabel = "high" | "medium" | "limited";
export type ScanStageName =
  | "fetch"
  | "discovery"
  | "extraction"
  | "scoring"
  | "render";

export type ScanStageTiming = {
  stage: ScanStageName;
  duration_ms: number;
  budget_ms: number;
  status: "within_budget" | "over_budget";
};

export type ScanQualitySummary = {
  score: number;
  label: ScanQualityLabel;
  status: ScanCompletenessStatus;
  alerts_allowed: boolean;
  confidence_impact: string;
  pages_attempted: number;
  pages_analyzed: number;
  successful_pages: number;
  failed_pages: number;
  duration_ms: number;
  completed: string[];
  skipped: string[];
  missing_categories: string[];
  warnings: string[];
  stage_timings: ScanStageTiming[];
};

type BuildIntelligenceScanQualityInput = {
  pagesAttempted: number;
  pages: PageIntelligence[];
  scrapes?: ScrapedPage[];
  durationMs: number;
  stageTimings?: ScanStageTiming[];
  warnings?: string[];
  skipped?: string[];
};

type BuildMonitoringScanQualityInput = {
  pagesAttempted: number;
  successfulPages: number;
  failedPages: number;
  durationMs: number;
  stageTimings?: ScanStageTiming[];
  warnings?: string[];
  skipped?: string[];
};

const stageBudgetsMs: Record<ScanStageName, number> = {
  fetch: 2000,
  discovery: 2000,
  extraction: 2000,
  scoring: 1000,
  render: 1000,
};

const criticalCategories = ["pricing", "positioning", "cta", "features"];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function labelForScore(score: number): ScanQualityLabel {
  if (score >= 80) {
    return "high";
  }

  if (score >= 60) {
    return "medium";
  }

  return "limited";
}

function statusForScore({
  score,
  pagesAnalyzed,
  failedPages,
  missingCritical,
}: {
  score: number;
  pagesAnalyzed: number;
  failedPages: number;
  missingCritical: number;
}): ScanCompletenessStatus {
  if (!pagesAnalyzed || score < 55) {
    return "limited";
  }

  if (score >= 80 && failedPages === 0 && missingCritical <= 1) {
    return "complete";
  }

  return "partial";
}

export function measureStage(
  stage: ScanStageName,
  startedAt: number,
): ScanStageTiming {
  const duration = Date.now() - startedAt;
  const budget = stageBudgetsMs[stage];

  return {
    stage,
    duration_ms: duration,
    budget_ms: budget,
    status: duration <= budget ? "within_budget" : "over_budget",
  };
}

function speedScore(durationMs: number) {
  if (durationMs <= 4000) {
    return 20;
  }

  if (durationMs <= 8000) {
    return 18;
  }

  if (durationMs <= 12000) {
    return 12;
  }

  if (durationMs <= 20000) {
    return 6;
  }

  return 0;
}

function confidenceValue(fact: StructuredFact) {
  if (fact.confidence === "high") {
    return Math.max(0.8, fact.confidence_score);
  }

  if (fact.confidence === "medium") {
    return Math.max(0.55, fact.confidence_score);
  }

  return Math.min(0.54, fact.confidence_score || 0.35);
}

function averageFactConfidence(pages: PageIntelligence[]) {
  const facts = pages.flatMap((page) => page.facts);

  if (!facts.length) {
    return 0;
  }

  return (
    facts.reduce((sum, fact) => sum + confidenceValue(fact), 0) / facts.length
  );
}

function categoryCoverage(pages: PageIntelligence[]) {
  const pricingFound = pages.some(
    (page) =>
      page.pricing.status === "found" ||
      page.pricing.status === "contact_sales" ||
      Boolean(page.pricing.lowestPrice || page.pricing.contactSales),
  );
  const positioningFound = pages.some(
    (page) =>
      page.positioning.status === "found" ||
      Boolean(page.positioning.homepageHeadline || page.positioning.mainValueProp),
  );
  const ctaFound = pages.some(
    (page) => page.ctas.status === "found" || Boolean(page.ctas.primaryCta),
  );
  const featureCount = pages.flatMap((page) => page.features.features).length;
  const featuresFound = featureCount >= 3;
  const changelogFound = pages.some(
    (page) => page.changelog.status === "found" || page.changelog.changelogUrl,
  );
  const completed = [
    pricingFound ? "pricing" : null,
    positioningFound ? "positioning" : null,
    ctaFound ? "cta" : null,
    featuresFound ? "features" : null,
    changelogFound ? "changelog" : null,
  ].filter((value): value is string => Boolean(value));
  const missingCategories = criticalCategories.filter(
    (category) => !completed.includes(category),
  );

  return {
    completed,
    missingCategories,
    criticalCompleted:
      Number(pricingFound) +
      Number(positioningFound) +
      Number(ctaFound) +
      Number(featuresFound),
    changelogFound,
  };
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function confidenceImpact({
  status,
  missingCategories,
  failedPages,
}: {
  status: ScanCompletenessStatus;
  missingCategories: string[];
  failedPages: number;
}) {
  if (status === "complete") {
    return "All core categories had usable evidence; scan confidence was not downgraded.";
  }

  const categoryText = missingCategories.length
    ? `Missing ${missingCategories.join(", ")} evidence`
    : "Some pages were incomplete";
  const failureText = failedPages ? ` and ${failedPages} page fetches failed` : "";

  return `${categoryText}${failureText}; results are useful but confidence is downgraded.`;
}

export function buildIntelligenceScanQuality({
  pagesAttempted,
  pages,
  scrapes = [],
  durationMs,
  stageTimings = [],
  warnings = [],
  skipped = [],
}: BuildIntelligenceScanQualityInput): ScanQualitySummary {
  const successfulPages = pages.length;
  const failedPages = Math.max(
    0,
    pagesAttempted - successfulPages,
    scrapes.filter((scrape) => !scrape.ok).length,
  );
  const successRatio =
    pagesAttempted > 0 ? successfulPages / Math.max(1, pagesAttempted) : 0;
  const categories = categoryCoverage(pages);
  const pageCoverageScore = successRatio * 12;
  const categoryScore = (categories.criticalCompleted / criticalCategories.length) * 18;
  const confidenceScore = averageFactConfidence(pages) * 25;
  const sectionScore = Math.min(15, pages.length * 3 + categories.completed.length * 2);
  const availabilityScore = successRatio * 10;
  const warningPenalty = Math.min(10, warnings.length * 1.5);
  const score = clampScore(
    pageCoverageScore +
      categoryScore +
      confidenceScore +
      speedScore(durationMs) +
      sectionScore +
      availabilityScore -
      warningPenalty,
  );
  const status = statusForScore({
    score,
    pagesAnalyzed: pages.length,
    failedPages,
    missingCritical: categories.missingCategories.length,
  });
  const label = labelForScore(score);
  const alertsAllowed = score >= 80 && status !== "limited" && failedPages <= 1;
  const skippedItems = unique([
    ...skipped,
    ...categories.missingCategories.map((category) => `${category} analysis incomplete`),
  ]);
  const qualityWarnings = unique([
    ...warnings,
    ...stageTimings
      .filter((timing) => timing.status === "over_budget")
      .map(
        (timing) =>
          `${timing.stage} exceeded ${timing.budget_ms}ms budget (${timing.duration_ms}ms).`,
      ),
  ]);

  return {
    score,
    label,
    status,
    alerts_allowed: alertsAllowed,
    confidence_impact: confidenceImpact({
      status,
      missingCategories: categories.missingCategories,
      failedPages,
    }),
    pages_attempted: pagesAttempted,
    pages_analyzed: pages.length,
    successful_pages: successfulPages,
    failed_pages: failedPages,
    duration_ms: durationMs,
    completed: unique([
      ...categories.completed,
      pages.length ? "baseline" : null,
      pages.length ? "intelligence snapshot" : null,
    ]),
    skipped: skippedItems,
    missing_categories: categories.missingCategories,
    warnings: qualityWarnings,
    stage_timings: stageTimings,
  };
}

export function buildMonitoringScanQuality({
  pagesAttempted,
  successfulPages,
  failedPages,
  durationMs,
  stageTimings = [],
  warnings = [],
  skipped = [],
}: BuildMonitoringScanQualityInput): ScanQualitySummary {
  const successRatio =
    pagesAttempted > 0 ? successfulPages / Math.max(1, pagesAttempted) : 1;
  const failurePenalty = failedPages * 8;
  const score = clampScore(
    successRatio * 50 +
      speedScore(durationMs) +
      (failedPages ? 8 : 20) +
      Math.min(10, successfulPages * 2.5) -
      failurePenalty -
      Math.min(10, warnings.length * 1.5),
  );
  const status = statusForScore({
    score,
    pagesAnalyzed: successfulPages,
    failedPages,
    missingCritical: 0,
  });
  const alertBlockedByPartial = status === "limited" || score < 80;
  const qualityWarnings = unique([
    ...warnings,
    ...stageTimings
      .filter((timing) => timing.status === "over_budget")
      .map(
        (timing) =>
          `${timing.stage} exceeded ${timing.budget_ms}ms budget (${timing.duration_ms}ms).`,
      ),
  ]);

  return {
    score,
    label: labelForScore(score),
    status,
    alerts_allowed: !alertBlockedByPartial,
    confidence_impact:
      status === "complete"
        ? "All monitored pages fetched successfully; change alerts can be trusted."
        : "Some monitored pages failed or were slow; alerting is downgraded until a retry succeeds.",
    pages_attempted: pagesAttempted,
    pages_analyzed: successfulPages,
    successful_pages: successfulPages,
    failed_pages: failedPages,
    duration_ms: durationMs,
    completed: unique([
      successfulPages ? "monitored page fetch" : null,
      successfulPages ? "change comparison" : null,
    ]),
    skipped: unique(skipped),
    missing_categories: [],
    warnings: qualityWarnings,
    stage_timings: stageTimings,
  };
}
