import type { CompetitorIntelligenceSnapshot, Json } from "@/lib/database.types";
import type { Confidence } from "@/lib/intelligence/types";

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

export type IntelligenceDisplayView = {
  snapshotId: string;
  createdAt: string;
  source: "openai" | "deterministic";
  overallConfidence: Confidence;
  pagesAnalyzed: number;
  overview: IntelligenceSectionView;
  pricing: IntelligenceSectionView;
  positioning: IntelligenceSectionView;
  cta: IntelligenceSectionView;
  changelog: IntelligenceSectionView;
  features: {
    status: "found" | "unavailable";
    text: string;
    facts: IntelligenceFactView[];
  };
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

function pricingSection(snapshot: IntelligenceSnapshotView): IntelligenceSectionView {
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
      text: `Detected ${weakPrice.value}, billing period unclear.`,
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
    text: "No public pricing block detected on this URL.",
  };
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
  return Array.from(new Set(warnings)).filter((warning) => {
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
    pagesAnalyzed: snapshot.analyzedPages.length,
    overview: overviewSection(snapshot),
    pricing,
    positioning,
    cta,
    changelog,
    features: featureDisplay,
    warnings: displayWarnings({
      warnings: [...snapshot.warnings, ...snapshot.summary.warnings],
      pricing,
      features: featureDisplay,
      changelog,
    }),
  };
}
