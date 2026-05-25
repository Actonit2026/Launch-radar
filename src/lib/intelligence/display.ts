import type { CompetitorIntelligenceSnapshot, Json } from "@/lib/database.types";
import type { BusinessProfile } from "@/lib/intelligence/business-profile";
import type { Confidence } from "@/lib/intelligence/types";
import type {
  ProgressiveScanStage,
  ScanCompletenessStatus,
  ScanDeliveryStatus,
  ScanQualityLabel,
  ScanQualitySummary,
} from "@/lib/scan-quality";

export const LIMITED_DATA_MESSAGE =
  "Initial scan completed, but reliable public data was limited.";

export type IntelligenceSummaryView = {
  executiveSummary: string | null;
  pricingSummary: string | null;
  positioningSummary: string | null;
  featureSummary: string | null;
  ctaSummary: string | null;
  unknowns: string[];
  warnings: string[];
  overallConfidence: Confidence;
  businessProfile: BusinessProfile | null;
  scanQuality: ScanQualitySummary | null;
};

export type IntelligenceFactView = {
  field: string;
  value: string;
  normalizedValue?: unknown;
  confidence: Confidence;
  confidenceScore: number;
  sourceUrl: string;
  evidenceText: string;
  extractionMethod: string;
};

export type AnalyzedPageView = {
  sourceUrl: string;
  pageType: string;
  title: string;
  fetchStatus: number | null;
  contentHash: string;
  extractedTextLength: number;
  factCount: number;
  warnings: string[];
};

export type IntelligenceSnapshotView = {
  id: string;
  createdAt: string;
  source: "openai" | "deterministic";
  summary: IntelligenceSummaryView;
  facts: IntelligenceFactView[];
  analyzedPages: AnalyzedPageView[];
  warnings: string[];
};

type PersistedIntelligenceSnapshot = Pick<
  CompetitorIntelligenceSnapshot,
  "id" | "created_at" | "source" | "warnings"
> & {
  summary?: Json;
  summary_json?: Json;
  facts?: Json;
  structured_facts_json?: Json;
  analyzed_pages: Json;
};

export type IntelligenceSectionView = {
  status: "found" | "unclear" | "unavailable";
  text: string;
  fact?: IntelligenceFactView;
};

export type PricingExperienceState =
  | "public_pricing"
  | "contact_sales"
  | "pricing_unclear"
  | "pricing_scanning"
  | "no_public_pricing";

export type PricingOptionView = {
  state: PricingExperienceState;
  label: string;
  text: string;
  confidence: Confidence;
  fact?: IntelligenceFactView;
};

export type IntelligenceDisplayView = {
  snapshotId: string;
  createdAt: string;
  source: "openai" | "deterministic";
  overallConfidence: Confidence;
  scanQuality: ScanQualitySummary | null;
  pagesAnalyzed: number;
  overview: IntelligenceSectionView;
  pricing: IntelligenceSectionView;
  pricingState: PricingExperienceState;
  pricingOptions: PricingOptionView[];
  pricingModelType: string | null;
  pricingCompleteness: number | null;
  billingModes: string[];
  pricingMissingData: string[];
  positioning: IntelligenceSectionView;
  cta: IntelligenceSectionView;
  changelog: IntelligenceSectionView;
  features: {
    status: "found" | "unavailable";
    text: string;
    facts: IntelligenceFactView[];
  };
  businessProfile: BusinessProfile | null;
  warnings: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function confidenceOrLow(value: unknown): Confidence {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : "low";
}

function scanQualityLabel(value: unknown): ScanQualityLabel {
  return value === "high" || value === "medium" || value === "limited"
    ? value
    : "limited";
}

function scanCompletenessStatus(value: unknown): ScanCompletenessStatus {
  return value === "complete" || value === "partial" || value === "limited"
    ? value
    : "limited";
}

function scanDeliveryStatus(value: unknown): ScanDeliveryStatus {
  return value === "useful" || value === "limited" || value === "failed"
    ? value
    : "limited";
}

function progressiveStage(value: unknown): ProgressiveScanStage | null {
  if (!isRecord(value)) {
    return null;
  }

  const name =
    value.name === "overview" ||
    value.name === "positioning_cta" ||
    value.name === "pricing_features" ||
    value.name === "deep_discovery"
      ? value.name
      : null;
  const status =
    value.status === "ready" ||
    value.status === "still_scanning" ||
    value.status === "limited"
      ? value.status
      : null;

  if (!name || !status) {
    return null;
  }

  return {
    name,
    status,
    target_ms: numberOrDefault(value.target_ms, 0),
    message: stringOrNull(value.message) ?? "Scan stage status unavailable.",
  };
}

function parseScanQuality(value: unknown): ScanQualitySummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const score = numberOrDefault(value.score, 0);

  return {
    score,
    label: scanQualityLabel(value.label),
    status: scanCompletenessStatus(value.status),
    delivery_status: scanDeliveryStatus(value.delivery_status),
    alerts_allowed: value.alerts_allowed === true,
    confidence_impact:
      stringOrNull(value.confidence_impact) ??
      "Scan confidence was not recorded for this snapshot.",
    time_to_useful_insight_ms:
      typeof value.time_to_useful_insight_ms === "number"
        ? value.time_to_useful_insight_ms
        : null,
    dashboard_complete_target_ms: numberOrDefault(
      value.dashboard_complete_target_ms,
      8000,
    ),
    progressive_stages: Array.isArray(value.progressive_stages)
      ? value.progressive_stages
          .map(progressiveStage)
          .filter((item): item is ProgressiveScanStage => Boolean(item))
      : [],
    pages_attempted: numberOrDefault(value.pages_attempted, 0),
    pages_analyzed: numberOrDefault(value.pages_analyzed, 0),
    successful_pages: numberOrDefault(value.successful_pages, 0),
    failed_pages: numberOrDefault(value.failed_pages, 0),
    duration_ms: numberOrDefault(value.duration_ms, 0),
    completed: stringArray(value.completed),
    skipped: stringArray(value.skipped),
    missing_categories: stringArray(value.missing_categories),
    warnings: stringArray(value.warnings),
    stage_timings: Array.isArray(value.stage_timings)
      ? value.stage_timings
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map((item) => ({
            stage:
              item.stage === "fetch" ||
              item.stage === "discovery" ||
              item.stage === "extraction" ||
              item.stage === "scoring" ||
              item.stage === "render"
                ? item.stage
                : "render",
            duration_ms: numberOrDefault(item.duration_ms, 0),
            budget_ms: numberOrDefault(item.budget_ms, 0),
            status:
              item.status === "within_budget" || item.status === "over_budget"
                ? item.status
                : "within_budget",
          }))
      : [],
  };
}

function cleanSummaryText(value: string | null) {
  if (!value) {
    return null;
  }

  const cleaned = value.replace(/\s+Source:\s+https?:\/\/\S+/gi, "").trim();
  return cleaned || null;
}

function isGenericSummary(value: string) {
  const normalized = value.toLowerCase();

  return (
    normalized.includes("is a saas product") ||
    normalized.includes("offers software solutions") ||
    normalized.includes("help businesses improve productivity")
  );
}

function parseSummary(value: Json): IntelligenceSummaryView {
  const summary = isRecord(value) ? value : {};

  return {
    executiveSummary: stringOrNull(summary.executive_summary),
    pricingSummary: stringOrNull(summary.pricing_summary),
    positioningSummary: stringOrNull(summary.positioning_summary),
    featureSummary: stringOrNull(summary.feature_summary),
    ctaSummary: stringOrNull(summary.cta_summary),
    unknowns: stringArray(summary.unknowns),
    warnings: stringArray(summary.warnings),
    overallConfidence: confidenceOrLow(summary.overall_confidence),
    businessProfile: isRecord(summary.business_profile)
      ? (summary.business_profile as BusinessProfile)
      : null,
    scanQuality: parseScanQuality(summary.scan_quality),
  };
}

function parseFact(value: unknown): IntelligenceFactView | null {
  if (!isRecord(value)) {
    return null;
  }

  const field = stringOrNull(value.field);
  const factValue = stringOrNull(value.value);
  const sourceUrl = stringOrNull(value.source_url);
  const evidenceText = stringOrNull(value.evidence_text);
  const extractionMethod = stringOrNull(value.extraction_method);

  if (!field || !factValue || !sourceUrl || !evidenceText || !extractionMethod) {
    return null;
  }

  return {
    field,
    value: factValue,
    normalizedValue: value.normalized_value,
    confidence: confidenceOrLow(value.confidence),
    confidenceScore: numberOrDefault(value.confidence_score, 0),
    sourceUrl,
    evidenceText,
    extractionMethod,
  };
}

function parseAnalyzedPage(value: unknown): AnalyzedPageView | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceUrl = stringOrNull(value.source_url);

  if (!sourceUrl) {
    return null;
  }

  return {
    sourceUrl,
    pageType: stringOrNull(value.page_type) ?? "unknown",
    title: stringOrNull(value.title) ?? "Untitled page",
    fetchStatus:
      typeof value.fetch_status === "number" ? value.fetch_status : null,
    contentHash: stringOrNull(value.content_hash) ?? "",
    extractedTextLength: numberOrDefault(value.extracted_text_length, 0),
    factCount: numberOrDefault(value.fact_count, 0),
    warnings: stringArray(value.warnings),
  };
}

export function parseIntelligenceSnapshot(
  row: PersistedIntelligenceSnapshot | null | undefined,
): IntelligenceSnapshotView | null {
  if (!row) {
    return null;
  }

  const summary = row.summary ?? row.summary_json ?? {};
  const facts = row.facts ?? row.structured_facts_json ?? [];

  return {
    id: row.id,
    createdAt: row.created_at,
    source: row.source,
    summary: parseSummary(summary),
    facts: Array.isArray(facts)
      ? facts.map(parseFact).filter((fact): fact is IntelligenceFactView =>
          Boolean(fact),
        )
      : [],
    analyzedPages: Array.isArray(row.analyzed_pages)
      ? row.analyzed_pages
          .map(parseAnalyzedPage)
          .filter((page): page is AnalyzedPageView => Boolean(page))
      : [],
    warnings: row.warnings,
  };
}

function reliableFacts(facts: IntelligenceFactView[]) {
  return facts.filter((fact) => fact.confidence !== "low");
}

function byConfidence(a: IntelligenceFactView, b: IntelligenceFactView) {
  return b.confidenceScore - a.confidenceScore;
}

function factsByField(snapshot: IntelligenceSnapshotView, field: string) {
  return snapshot.facts.filter((fact) => fact.field === field);
}

function bestFieldFact(
  snapshot: IntelligenceSnapshotView,
  fields: string[],
  includeLow = false,
) {
  return fields
    .flatMap((field) => factsByField(snapshot, field))
    .filter((fact) => includeLow || fact.confidence !== "low")
    .sort(byConfidence)[0];
}

function normalizedAmount(fact: IntelligenceFactView) {
  if (!isRecord(fact.normalizedValue)) {
    return Number.POSITIVE_INFINITY;
  }

  const amount = fact.normalizedValue.amount;
  const period = fact.normalizedValue.period;

  if (typeof amount !== "number") {
    return Number.POSITIVE_INFINITY;
  }

  return period === "year" ? amount / 12 : amount;
}

function priceOptionLabel(fact: IntelligenceFactView) {
  if (isRecord(fact.normalizedValue)) {
    const plan = stringOrNull(fact.normalizedValue.plan);

    if (plan) {
      return plan;
    }
  }

  return "Public price";
}

function priceOptionText(fact: IntelligenceFactView) {
  if (!isRecord(fact.normalizedValue)) {
    return fact.value;
  }

  const period = stringOrNull(fact.normalizedValue.period);
  const unit = stringOrNull(fact.normalizedValue.unit);
  const suffix = [
    period && period !== "unknown" ? `per ${period}` : null,
    unit ? `per ${unit}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return suffix ? `${fact.value} (${suffix})` : fact.value;
}

function planOptionLabel(fact: IntelligenceFactView) {
  return fact.value.split(":")[0]?.trim() || "Pricing plan";
}

function planOptionText(fact: IntelligenceFactView) {
  return fact.value.includes(":")
    ? fact.value.slice(fact.value.indexOf(":") + 1).trim()
    : fact.value;
}

function pricingOptions(snapshot: IntelligenceSnapshotView): PricingOptionView[] {
  const planOptions = factsByField(snapshot, "pricing_plan").map(
    (fact): PricingOptionView => {
      const isContact = /custom|contact sales|enterprise/i.test(fact.value);

      return {
        state: isContact ? "contact_sales" : "public_pricing",
        label: planOptionLabel(fact),
        text: planOptionText(fact),
        confidence: fact.confidence,
        fact,
      };
    },
  );
  const usageOptions = factsByField(snapshot, "usage_tier").map(
    (fact): PricingOptionView => ({
      state: fact.confidence === "low" ? "pricing_unclear" : "public_pricing",
      label: fact.value.split(":")[0]?.trim() || "Pricing option",
      text: fact.value,
      confidence: fact.confidence,
      fact,
    }),
  );
  const priceOptions = factsByField(snapshot, "visible_price")
    .sort((a, b) => normalizedAmount(a) - normalizedAmount(b) || byConfidence(a, b))
    .map((fact): PricingOptionView => ({
      state: fact.confidence === "low" ? "pricing_unclear" : "public_pricing",
      label: priceOptionLabel(fact),
      text: priceOptionText(fact),
      confidence: fact.confidence,
      fact,
    }));
  const freeOptions = factsByField(snapshot, "free_plan").map(
    (fact): PricingOptionView => ({
      state: "public_pricing",
      label: "Free plan",
      text: fact.value,
      confidence: fact.confidence,
      fact,
    }),
  );
  const contactOptions = factsByField(snapshot, "contact_sales").map(
    (fact): PricingOptionView => ({
      state: "contact_sales",
      label: "Contact sales",
      text: "Contact sales is visible on the public site.",
      confidence: fact.confidence,
      fact,
    }),
  );
  const structuredOptions = uniquePricingOptions([
    ...planOptions,
    ...usageOptions,
    ...freeOptions,
    ...contactOptions,
  ]);
  if (structuredOptions.length) {
    return structuredOptions;
  }

  const options = uniquePricingOptions([
    ...priceOptions,
  ]);

  if (options.length) {
    return options;
  }

  return [
    {
      state: "no_public_pricing",
      label: "No public pricing",
      text: "No public pricing detected.",
      confidence: "low",
    },
  ];
}

function uniquePricingOptions(options: PricingOptionView[]) {
  const seen = new Set<string>();

  return options.filter((option) => {
    const key = `${option.state}:${option.label}:${option.text}:${option.fact?.sourceUrl ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function pricingStateFromOptions(
  options: PricingOptionView[],
): PricingExperienceState {
  if (options.some((option) => option.state === "public_pricing")) {
    return "public_pricing";
  }

  if (options.some((option) => option.state === "contact_sales")) {
    return "contact_sales";
  }

  if (options.some((option) => option.state === "pricing_unclear")) {
    return "pricing_unclear";
  }

  return "no_public_pricing";
}

function pricingSection(snapshot: IntelligenceSnapshotView): IntelligenceSectionView {
  const plans = factsByField(snapshot, "pricing_plan");
  const tiers = factsByField(snapshot, "usage_tier");
  const modelType = bestFieldFact(snapshot, ["pricing_model_type"], true);
  const completeness = bestFieldFact(snapshot, ["pricing_completeness"], true);

  if (plans.length || tiers.length) {
    const pieces = [
      plans.length ? `${plans.length} plan${plans.length === 1 ? "" : "s"}` : null,
      tiers.length ? `${tiers.length} usage tier${tiers.length === 1 ? "" : "s"}` : null,
      modelType ? modelType.value.replace(/_/g, " ") : null,
      completeness ? `${completeness.value}/100 complete` : null,
    ].filter(Boolean);

    return {
      status: "found",
      text: pieces.length
        ? `Detected ${pieces.join(", ")}.`
        : "Structured public pricing detected.",
      fact: plans[0] ?? tiers[0],
    };
  }

  const prices = factsByField(snapshot, "visible_price").sort(
    (a, b) => normalizedAmount(a) - normalizedAmount(b) || byConfidence(a, b),
  );
  const reliablePrice = prices.find((fact) => fact.confidence !== "low");
  const weakPrice = prices[0];
  const freePlan = bestFieldFact(snapshot, ["free_plan"]);
  const contactSales = bestFieldFact(snapshot, ["contact_sales"]);

  if (reliablePrice) {
    const period =
      isRecord(reliablePrice.normalizedValue) &&
      typeof reliablePrice.normalizedValue.period === "string"
        ? reliablePrice.normalizedValue.period
        : null;
    const hasKnownPeriod = period && period !== "unknown";

    return {
      status: "found",
      text: hasKnownPeriod
        ? `Lowest visible price: ${reliablePrice.value}`
        : `Detected ${reliablePrice.value}, billing period unclear.`,
      fact: reliablePrice,
    };
  }

  if (weakPrice) {
    return {
      status: "unclear",
      text: `Pricing unclear: detected ${weakPrice.value}, but confidence was limited.`,
      fact: weakPrice,
    };
  }

  if (freePlan) {
    return { status: "found", text: freePlan.value, fact: freePlan };
  }

  if (contactSales) {
    return {
      status: "found",
      text: "Contact sales is visible on the public site.",
      fact: contactSales,
    };
  }

  return {
    status: "unavailable",
    text: "No public pricing detected.",
  };
}

function pricingModelType(snapshot: IntelligenceSnapshotView) {
  return bestFieldFact(snapshot, ["pricing_model_type"], true)?.value ?? null;
}

function pricingCompleteness(snapshot: IntelligenceSnapshotView) {
  const fact = bestFieldFact(snapshot, ["pricing_completeness"], true);
  const value = fact ? Number(fact.value) : Number.NaN;

  return Number.isFinite(value) ? value : null;
}

function billingModes(snapshot: IntelligenceSnapshotView) {
  return uniquePricingOptions(
    factsByField(snapshot, "billing_mode").map((fact) => ({
      state: "public_pricing" as const,
      label: fact.value,
      text: fact.value,
      confidence: fact.confidence,
      fact,
    })),
  ).map((option) => option.label);
}

function pricingMissingData(snapshot: IntelligenceSnapshotView) {
  return Array.from(
    new Set(
      factsByField(snapshot, "pricing_missing_data").map((fact) => fact.value),
    ),
  );
}

function positioningSection(
  snapshot: IntelligenceSnapshotView,
): IntelligenceSectionView {
  const fact = bestFieldFact(snapshot, [
    "homepage_headline",
    "main_value_prop",
    "subheadline",
    "product_category",
  ]);

  if (!fact) {
    return {
      status: "unclear",
      text: "Positioning unclear from public page content.",
    };
  }

  return { status: "found", text: fact.value, fact };
}

function ctaSection(snapshot: IntelligenceSnapshotView): IntelligenceSectionView {
  const fact = bestFieldFact(snapshot, ["primary_cta", "secondary_cta"]);

  if (!fact) {
    return { status: "unavailable", text: "No clear call to action detected." };
  }

  return { status: "found", text: fact.value, fact };
}

function changelogSection(
  snapshot: IntelligenceSnapshotView,
): IntelligenceSectionView {
  const detected = bestFieldFact(snapshot, ["changelog_detected"]);

  if (!detected) {
    return {
      status: "unavailable",
      text: "No changelog/update page detected.",
    };
  }

  const recentUpdate = bestFieldFact(snapshot, ["recent_update_title"]);
  const lastVisibleDate = bestFieldFact(snapshot, ["last_visible_update_date"]);
  const text = recentUpdate
    ? `Recent update: ${recentUpdate.value}`
    : lastVisibleDate
      ? `Last visible update: ${lastVisibleDate.value}`
      : "Changelog/update page detected.";

  return { status: "found", text, fact: recentUpdate ?? lastVisibleDate ?? detected };
}

function featureFacts(snapshot: IntelligenceSnapshotView) {
  return reliableFacts(factsByField(snapshot, "feature"))
    .sort(byConfidence)
    .slice(0, 10);
}

function overviewSection(snapshot: IntelligenceSnapshotView): IntelligenceSectionView {
  const summary = cleanSummaryText(snapshot.summary.executiveSummary);

  if (
    summary &&
    !isGenericSummary(summary) &&
    (snapshot.summary.overallConfidence !== "low" ||
      reliableFacts(snapshot.facts).length > 0)
  ) {
    return { status: "found", text: summary };
  }

  return { status: "unavailable", text: LIMITED_DATA_MESSAGE };
}

function displayWarnings({
  warnings,
  pricing,
  features,
  changelog,
}: {
  warnings: string[];
  pricing: IntelligenceSectionView;
  features: { status: "found" | "unavailable" };
  changelog: IntelligenceSectionView;
}) {
  const sanitized = warnings.map((warning) => {
    if (/openai|api key|api_key|ai summary unavailable/i.test(warning)) {
      return "Deterministic analysis shown. AI enhancement is disabled for this plan.";
    }

    if (/http\s?(?:401|403)|unauthori[sz]ed|forbidden|blocked/i.test(warning)) {
      return "Some pages could not be retrieved.";
    }

    if (/stack|trace|raw json|route|secret|env|supabase|stripe|token|timing|budget|ms\b/i.test(warning)) {
      return "Scan completed with limited coverage.";
    }

    if (/pricing debug|rejected/i.test(warning)) {
      return "Some pricing-like text was ignored because it did not look like product pricing.";
    }

    return warning;
  });

  return Array.from(new Set(sanitized)).filter((warning) => {
    if (
      pricing.status === "found" &&
      /no (?:reliable )?public pricing(?: block)? detected/i.test(warning)
    ) {
      return false;
    }

    if (
      features.status === "found" &&
      /not enough feature information detected/i.test(warning)
    ) {
      return false;
    }

    if (
      changelog.status === "found" &&
      /no changelog\/update page detected/i.test(warning)
    ) {
      return false;
    }

    return true;
  });
}

export function buildIntelligenceDisplay(
  snapshot: IntelligenceSnapshotView | null,
): IntelligenceDisplayView | null {
  if (!snapshot) {
    return null;
  }

  const features = featureFacts(snapshot);
  const pricing = pricingSection(snapshot);
  const allPricingOptions = pricingOptions(snapshot);
  const pricingState = pricingStateFromOptions(allPricingOptions);
  const positioning = positioningSection(snapshot);
  const cta = ctaSection(snapshot);
  const changelog = changelogSection(snapshot);
  const featureDisplay =
    features.length >= 3
      ? {
          status: "found" as const,
          text: "Verified features detected.",
          facts: features,
        }
      : {
          status: "unavailable" as const,
          text: "Not enough feature information detected.",
          facts: [],
        };

  return {
    snapshotId: snapshot.id,
    createdAt: snapshot.createdAt,
    source: snapshot.source,
    overallConfidence: snapshot.summary.overallConfidence,
    scanQuality: snapshot.summary.scanQuality,
    pagesAnalyzed: snapshot.analyzedPages.length,
    overview: overviewSection(snapshot),
    pricing,
    pricingState,
    pricingOptions: allPricingOptions,
    pricingModelType: pricingModelType(snapshot),
    pricingCompleteness: pricingCompleteness(snapshot),
    billingModes: billingModes(snapshot),
    pricingMissingData: pricingMissingData(snapshot),
    positioning,
    cta,
    changelog,
    features: featureDisplay,
    businessProfile: snapshot.summary.businessProfile,
    warnings: displayWarnings({
      warnings: [...snapshot.warnings, ...snapshot.summary.warnings],
      pricing,
      features: featureDisplay,
      changelog,
    }),
  };
}
