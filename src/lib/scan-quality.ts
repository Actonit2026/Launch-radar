import type { ScrapedPage } from "@/lib/crawler/scraper";
import type { PageIntelligence, StructuredFact } from "@/lib/intelligence/types";

export type ScanCompletenessStatus = "complete" | "partial" | "limited";
export type ScanQualityLabel = "high" | "medium" | "limited";
export type ScanDeliveryStatus = "useful" | "limited" | "failed";
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

export type ProgressiveScanStage = {
  name: "overview" | "positioning_cta" | "pricing_features" | "deep_discovery";
  target_ms: number;
  status: "ready" | "still_scanning" | "limited";
  message: string;
};

export type ScanQualitySummary = {
  score: number;
  label: ScanQualityLabel;
  status: ScanCompletenessStatus;
  delivery_status: ScanDeliveryStatus;
  alerts_allowed: boolean;
  confidence_impact: string;
  time_to_useful_insight_ms: number | null;
  dashboard_complete_target_ms: number;
  progressive_stages: ProgressiveScanStage[];
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

function usefulInsightSpeedScore(durationMs: number | null) {
  if (durationMs === null) {
    return 0;
  }

  if (durationMs <= 1500) {
    return 20;
  }

  if (durationMs <= 3000) {
    return 18;
  }

  if (durationMs <= 5000) {
    return 14;
  }

  if (durationMs <= 8000) {
    return 8;
  }

  return 3;
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
    pricingFound,
    positioningFound,
    ctaFound,
    featuresFound,
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

function scanDeliveryStatus({
  pagesAnalyzed,
  positioningFound,
  ctaFound,
  additionalUsefulDimension,
}: {
  pagesAnalyzed: number;
  positioningFound: boolean;
  ctaFound: boolean;
  additionalUsefulDimension: boolean;
}): ScanDeliveryStatus {
  if (!pagesAnalyzed) {
    return "failed";
  }

  if (positioningFound && ctaFound && additionalUsefulDimension) {
    return "useful";
  }

  return "limited";
}

function stageDuration(stageTimings: ScanStageTiming[], stages: ScanStageName[]) {
  const stageSet = new Set(stages);

  return stageTimings
    .filter((timing) => stageSet.has(timing.stage))
    .reduce((sum, timing) => sum + timing.duration_ms, 0);
}

function usefulInsightMs({
  deliveryStatus,
  durationMs,
  stageTimings,
}: {
  deliveryStatus: ScanDeliveryStatus;
  durationMs: number;
  stageTimings: ScanStageTiming[];
}) {
  if (deliveryStatus === "failed") {
    return null;
  }

  const measured = stageDuration(stageTimings, ["discovery", "fetch", "extraction"]);

  return measured > 0 ? measured : durationMs;
}

function progressiveStages({
  deliveryStatus,
  categories,
}: {
  deliveryStatus: ScanDeliveryStatus;
  categories: ReturnType<typeof categoryCoverage>;
}): ProgressiveScanStage[] {
  return [
    {
      name: "overview",
      target_ms: 1500,
      status: deliveryStatus === "failed" ? "limited" : "ready",
      message:
        deliveryStatus === "failed"
          ? "Website availability could not be verified."
          : "Overview and availability are ready.",
    },
    {
      name: "positioning_cta",
      target_ms: 3000,
      status:
        categories.positioningFound && categories.ctaFound
          ? "ready"
          : "limited",
      message:
        categories.positioningFound && categories.ctaFound
          ? "Positioning and primary CTA are ready."
          : "Positioning or CTA evidence is limited.",
    },
    {
      name: "pricing_features",
      target_ms: 5000,
      status:
        categories.pricingFound && categories.featuresFound
          ? "ready"
          : "still_scanning",
      message:
        categories.pricingFound && categories.featuresFound
          ? "Pricing and feature evidence are ready."
          : "Pricing or feature evidence may need targeted background checks.",
    },
    {
      name: "deep_discovery",
      target_ms: 8000,
      status: categories.changelogFound ? "ready" : "still_scanning",
      message: categories.changelogFound
        ? "Extended discovery found update signals."
        : "Extended discovery can continue in the background.",
    },
  ];
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
  const categories = categoryCoverage(pages);
  const deliveryStatus = scanDeliveryStatus({
    pagesAnalyzed: pages.length,
    positioningFound: categories.positioningFound,
    ctaFound: categories.ctaFound,
    additionalUsefulDimension:
      categories.pricingFound || categories.featuresFound || categories.changelogFound,
  });
  const insightMs = usefulInsightMs({
    deliveryStatus,
    durationMs,
    stageTimings,
  });
  const usefulnessScore =
    deliveryStatus === "useful"
      ? 35
      : deliveryStatus === "limited"
        ? Math.max(12, (categories.criticalCompleted / criticalCategories.length) * 28)
        : 0;
  const clarityScore = Math.max(
    0,
    25 -
      categories.missingCategories.length * 3 -
      Math.min(8, warnings.length),
  );
  const correctnessScore = averageFactConfidence(pages) * 20;
  const warningPenalty = Math.min(10, warnings.length * 1.5);
  const score = clampScore(
    usefulnessScore +
      clarityScore +
      correctnessScore +
      usefulInsightSpeedScore(insightMs) -
      warningPenalty * 0.4,
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
    delivery_status: deliveryStatus,
    alerts_allowed: alertsAllowed,
    confidence_impact: confidenceImpact({
      status,
      missingCategories: categories.missingCategories,
      failedPages,
    }),
    time_to_useful_insight_ms: insightMs,
    dashboard_complete_target_ms: 8000,
    progressive_stages: progressiveStages({ deliveryStatus, categories }),
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
  const deliveryStatus: ScanDeliveryStatus = successfulPages
    ? "useful"
    : "failed";
  const insightMs = deliveryStatus === "useful" ? durationMs : null;
  const score = clampScore(
    successRatio * 35 +
      25 +
      (failedPages ? 12 : 20) +
      usefulInsightSpeedScore(insightMs) -
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
    delivery_status: deliveryStatus,
    alerts_allowed: !alertBlockedByPartial,
    confidence_impact:
      status === "complete"
        ? "All monitored pages fetched successfully; change alerts can be trusted."
        : "Some monitored pages failed or were slow; alerting is downgraded until a retry succeeds.",
    time_to_useful_insight_ms: insightMs,
    dashboard_complete_target_ms: 8000,
    progressive_stages: [
      {
        name: "overview",
        target_ms: 1500,
        status: successfulPages ? "ready" : "limited",
        message: successfulPages
          ? "Fresh page availability is ready."
          : "No monitored page was reachable.",
      },
      {
        name: "positioning_cta",
        target_ms: 3000,
        status: successfulPages ? "ready" : "limited",
        message: successfulPages
          ? "Change comparison is ready for reachable pages."
          : "Change comparison needs at least one reachable page.",
      },
      {
        name: "pricing_features",
        target_ms: 5000,
        status: failedPages ? "still_scanning" : "ready",
        message: failedPages
          ? "Failed pages should be retried without rerunning successful pages."
          : "All fetched monitored pages are ready.",
      },
      {
        name: "deep_discovery",
        target_ms: 8000,
        status: "still_scanning",
        message: "Extended discovery is not required for scheduled freshness.",
      },
    ],
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
