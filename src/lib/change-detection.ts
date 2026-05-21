import { createHash } from "node:crypto";
import type { DetectedChange, Json, PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import { analyzePageIntelligence } from "@/lib/intelligence/analyze";
import type {
  CtaFact,
  FeatureFact,
  NormalizedPrice,
  PageIntelligence,
  StructuredFact,
} from "@/lib/intelligence/types";

type Severity = DetectedChange["severity"];

type SnapshotPrice = {
  amount: number;
  currency: string;
  period: string | null;
  unit: string | null;
  confidence: string;
  confidence_score: number;
  source_url: string;
  evidence_text: string;
};

type SnapshotTextFact = {
  value: string;
  normalized_value: string;
  confidence: string;
  confidence_score: number;
  source_url: string;
  evidence_text: string;
};

type SnapshotCta = SnapshotTextFact & {
  intent: string;
  destination_url: string | null;
};

type SnapshotFeature = SnapshotTextFact & {
  name: string;
  description: string | null;
};

export type SnapshotFacts = {
  page_type: PageType;
  source_url: string;
  title: string;
  availability: {
    ok: boolean;
    fetch_status: number | null;
  };
  pricing: {
    status: string;
    free_plan: SnapshotTextFact | null;
    contact_sales: SnapshotTextFact | null;
    lowest_price: SnapshotPrice | null;
    highest_price: SnapshotPrice | null;
    paid_prices: SnapshotPrice[];
    plan_names: SnapshotTextFact[];
    pricing_tier_count: number | null;
  };
  positioning: {
    status: string;
    homepage_headline: SnapshotTextFact | null;
    subheadline: SnapshotTextFact | null;
    product_category: SnapshotTextFact | null;
    target_customer: SnapshotTextFact | null;
    main_value_prop: SnapshotTextFact | null;
    key_use_case: SnapshotTextFact | null;
  };
  ctas: {
    status: string;
    primary_cta: SnapshotCta | null;
    secondary_cta: SnapshotCta | null;
    ctas: SnapshotCta[];
  };
  features: {
    status: string;
    features: SnapshotFeature[];
  };
  changelog: {
    status: string;
    changelog_detected: boolean;
    changelog_url: string | null;
    last_visible_update_date: SnapshotTextFact | null;
    recent_update_titles: SnapshotTextFact[];
  };
  facts: Array<{
    field: string;
    value: string;
    normalized_value: unknown;
    confidence: string;
    confidence_score: number;
    source_url: string;
    evidence_text: string;
    extraction_method: string;
  }>;
};

export type SnapshotAnalysis = {
  rawText: string;
  rawContentHash: string;
  canonicalContent: string;
  canonicalContentHash: string;
  structuredFacts: SnapshotFacts;
  structuredFactsHash: string;
  intelligence: PageIntelligence;
};

export type MeaningfulChange = {
  category:
    | "availability"
    | "pricing"
    | "cta"
    | "positioning"
    | "features"
    | "changelog"
    | "content";
  changeType: string;
  summary: string;
  severity: Severity;
  confidenceScore: number;
  whyItMatters: string;
  evidence: Array<{
    source_url: string;
    evidence_text: string;
  }>;
};

export type SnapshotComparison = {
  rawChanged: boolean;
  canonicalChanged: boolean;
  structuredFactsChanged: boolean;
  meaningfulChanges: MeaningfulChange[];
  ignoredReasons: string[];
};

const trackingParams = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "wbraid",
]);

const entityMap: Record<string, string> = {
  amp: "&",
  gt: ">",
  lt: "<",
  nbsp: " ",
  pound: "\u00a3",
  quot: '"',
  euro: "\u20ac",
};

const businessSignalPattern =
  /\b(?:pricing|price|plan|plans|free|trial|demo|contact sales|book|started|feature|integration|automation|analytics|security|launch|release|update|changelog|customer|teams|agencies|founders|platform|workflow)\b/i;

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function decodeEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = String(entity).toLowerCase();

    if (key.startsWith("#x")) {
      const codePoint = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (key.startsWith("#")) {
      const codePoint = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return entityMap[key] ?? match;
  });
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    const paramsToDelete: string[] = [];

    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.searchParams.forEach((_, key) => {
      const normalizedKey = key.toLowerCase();

      if (normalizedKey.startsWith("utm_") || trackingParams.has(normalizedKey)) {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach((key) => url.searchParams.delete(key));
    url.searchParams.sort();

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return normalizeComparableText(value);
  }
}

export function normalizeComparableText(value: string) {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\b(?:id|class|data-[a-z0-9-]+|aria-[a-z0-9-]+)=["'][^"']*["']/gi, " ")
    .replace(/\b(?:build|chunk|webpack|next|vercel)[-_:]?[a-z0-9]{6,}\b/gi, " ")
    .replace(/\b[a-f0-9]{16,}\b/gi, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm)?\b/gi, " ")
    .replace(/([$\u20ac\u00a3])\s+(\d)/g, "$1$2")
    .replace(/(\d)\s+([$\u20ac\u00a3])/g, "$1$2")
    .replace(/\s*\/\s*(?:mo|month|monthly)\b/gi, "/month")
    .replace(/\s*\/\s*(?:yr|year|yearly)\b/gi, "/year")
    .replace(/\bper\s+month\b/gi, "/month")
    .replace(/\bper\s+year\b/gi, "/year")
    .replace(/\bmonthly\b/gi, "/month")
    .replace(/\byearly\b|\bannually\b/gi, "/year")
    .toLowerCase()
    .replace(/\s+([,.;:!?/])/g, "$1")
    .replace(/([,.;:!?/])(?=\S)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBoilerplateSegment(value: string) {
  if (value.length < 2) {
    return true;
  }

  if (
    /^(accept|reject|allow all|manage cookies|cookie settings|privacy policy|terms|terms of service|legal|all rights reserved|copyright)$/i.test(
      value,
    )
  ) {
    return true;
  }

  if (
    /^(facebook|twitter|x|linkedin|instagram|youtube|github|discord|slack)$/i.test(
      value,
    )
  ) {
    return true;
  }

  if (/\bcookie\b|\ball rights reserved\b|\bcopyright\b/i.test(value)) {
    return true;
  }

  return false;
}

function canonicalSegments(rawContent: string) {
  const seen = new Set<string>();
  const segments: string[] = [];

  for (const rawSegment of rawContent.split(/\n+/)) {
    const segment = normalizeComparableText(rawSegment);

    if (!segment || isBoilerplateSegment(segment) || seen.has(segment)) {
      continue;
    }

    seen.add(segment);
    segments.push(segment);
  }

  return segments.sort();
}

export function normalizeForChangeDetection(rawContent: string) {
  return canonicalSegments(rawContent).join("\n");
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }

  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function isNormalizedPrice(value: unknown): value is NormalizedPrice {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as NormalizedPrice).amount === "number" &&
    typeof (value as NormalizedPrice).currency === "string"
  );
}

function compactTextFact(
  fact: StructuredFact | null | undefined,
): SnapshotTextFact | null {
  if (!fact) {
    return null;
  }

  return {
    value: fact.value,
    normalized_value: normalizeComparableText(fact.value),
    confidence: fact.confidence,
    confidence_score: fact.confidence_score,
    source_url: normalizeUrl(fact.source_url),
    evidence_text: fact.evidence_text,
  };
}

function compactPriceFact(
  fact: StructuredFact<NormalizedPrice> | null | undefined,
): SnapshotPrice | null {
  if (!fact || !isNormalizedPrice(fact.normalized_value)) {
    return null;
  }

  return {
    amount: fact.normalized_value.amount,
    currency: fact.normalized_value.currency,
    period: fact.normalized_value.period ?? null,
    unit: fact.normalized_value.unit ?? null,
    confidence: fact.confidence,
    confidence_score: fact.confidence_score,
    source_url: normalizeUrl(fact.source_url),
    evidence_text: fact.evidence_text,
  };
}

function compactCtaFact(fact: CtaFact | null | undefined): SnapshotCta | null {
  const compact = compactTextFact(fact);

  if (!fact || !compact) {
    return null;
  }

  return {
    ...compact,
    intent: fact.normalized_value?.intent ?? "unknown",
    destination_url: normalizeUrl(fact.normalized_value?.destination_url),
  };
}

function compactFeatureFact(
  fact: FeatureFact | null | undefined,
): SnapshotFeature | null {
  const compact = compactTextFact(fact);

  if (!fact || !compact) {
    return null;
  }

  const name = normalizeComparableText(
    fact.normalized_value?.name ?? fact.value,
  );

  return {
    ...compact,
    name,
    description: fact.normalized_value?.description
      ? normalizeComparableText(fact.normalized_value.description)
      : null,
  };
}

function isWeakCtaFact(fact: SnapshotCta) {
  return (
    (fact.intent === "view_pricing" &&
      /^(?:pricing|plans|packages)$/.test(fact.normalized_value)) ||
    /^(?:login|log in|sign in|home|features|docs|blog)$/.test(
      fact.normalized_value,
    )
  );
}

function compactFacts(facts: StructuredFact[]) {
  return facts
    .map((fact) => ({
      field: fact.field,
      value: fact.value,
      normalized_value:
        fact.normalized_value === undefined
          ? null
          : JSON.parse(JSON.stringify(fact.normalized_value)) as unknown,
      confidence: fact.confidence,
      confidence_score: fact.confidence_score,
      source_url: normalizeUrl(fact.source_url),
      evidence_text: fact.evidence_text,
      extraction_method: fact.extraction_method,
    }))
    .sort((a, b) =>
      `${a.field}:${normalizeComparableText(a.value)}`.localeCompare(
        `${b.field}:${normalizeComparableText(b.value)}`,
      ),
    );
}

function compactPageIntelligence(page: PageIntelligence): SnapshotFacts {
  const ctas = page.ctas.ctas
    .map(compactCtaFact)
    .filter((fact): fact is SnapshotCta => Boolean(fact))
    .filter((fact) => !isWeakCtaFact(fact))
    .sort((a, b) =>
      `${a.intent}:${a.normalized_value}:${a.destination_url ?? ""}`.localeCompare(
        `${b.intent}:${b.normalized_value}:${b.destination_url ?? ""}`,
      ),
    );

  return {
    page_type: page.pageType,
    source_url: normalizeUrl(page.sourceUrl),
    title: page.title,
    availability: {
      ok: page.fetchStatus === null || page.fetchStatus < 400,
      fetch_status: page.fetchStatus,
    },
    pricing: {
      status: page.pricing.status,
      free_plan: compactTextFact(page.pricing.freePlan),
      contact_sales: compactTextFact(page.pricing.contactSales),
      lowest_price: compactPriceFact(page.pricing.lowestPrice),
      highest_price: compactPriceFact(page.pricing.highestPrice),
      paid_prices: page.pricing.paidPlans
        .map(compactPriceFact)
        .filter((fact): fact is SnapshotPrice => Boolean(fact))
        .sort((a, b) => priceKey(a).localeCompare(priceKey(b))),
      plan_names: page.pricing.planNames
        .map(compactTextFact)
        .filter((fact): fact is SnapshotTextFact => Boolean(fact))
        .sort((a, b) =>
          a.normalized_value.localeCompare(b.normalized_value),
        ),
      pricing_tier_count:
        typeof page.pricing.pricingTierCount?.normalized_value === "number"
          ? page.pricing.pricingTierCount.normalized_value
          : null,
    },
    positioning: {
      status: page.positioning.status,
      homepage_headline: compactTextFact(page.positioning.homepageHeadline),
      subheadline: compactTextFact(page.positioning.subheadline),
      product_category: compactTextFact(page.positioning.productCategory),
      target_customer: compactTextFact(page.positioning.targetCustomer),
      main_value_prop: compactTextFact(page.positioning.mainValueProp),
      key_use_case: compactTextFact(page.positioning.keyUseCase),
    },
    ctas: {
      status: ctas.length ? "found" : "unavailable",
      primary_cta: ctas[0] ?? null,
      secondary_cta: ctas[1] ?? null,
      ctas,
    },
    features: {
      status: page.features.status,
      features: page.features.features
        .map(compactFeatureFact)
        .filter((fact): fact is SnapshotFeature => Boolean(fact))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
    changelog: {
      status: page.changelog.status,
      changelog_detected: Boolean(page.changelog.changelogDetected),
      changelog_url: normalizeUrl(page.changelog.changelogUrl),
      last_visible_update_date: compactTextFact(
        page.changelog.lastVisibleUpdateDate,
      ),
      recent_update_titles: page.changelog.recentUpdateTitles
        .map(compactTextFact)
        .filter((fact): fact is SnapshotTextFact => Boolean(fact))
        .sort((a, b) =>
          a.normalized_value.localeCompare(b.normalized_value),
        ),
    },
    facts: compactFacts(page.facts),
  };
}

function hashableFacts(facts: SnapshotFacts) {
  return {
    page_type: facts.page_type,
    availability: facts.availability,
    pricing: {
      status: facts.pricing.status,
      free_plan: Boolean(facts.pricing.free_plan),
      contact_sales: Boolean(facts.pricing.contact_sales),
      lowest_price: facts.pricing.lowest_price
        ? priceKey(facts.pricing.lowest_price)
        : null,
      highest_price: facts.pricing.highest_price
        ? priceKey(facts.pricing.highest_price)
        : null,
      paid_prices: facts.pricing.paid_prices.map(priceKey),
      plan_names: facts.pricing.plan_names.map(
        (fact) => fact.normalized_value,
      ),
      pricing_tier_count: facts.pricing.pricing_tier_count,
    },
    positioning: Object.fromEntries(
      Object.entries(facts.positioning).map(([key, value]) => [
        key,
        value && typeof value === "object" && "normalized_value" in value
          ? value.normalized_value
          : value,
      ]),
    ),
    ctas: {
      status: facts.ctas.status,
      primary_cta: facts.ctas.primary_cta
        ? ctaKey(facts.ctas.primary_cta)
        : null,
      secondary_cta: facts.ctas.secondary_cta
        ? ctaKey(facts.ctas.secondary_cta)
        : null,
      ctas: facts.ctas.ctas.map(ctaKey),
    },
    features: {
      status: facts.features.status,
      features: facts.features.features.map((feature) => feature.name),
    },
    changelog: {
      status: facts.changelog.status,
      changelog_detected: facts.changelog.changelog_detected,
      changelog_url: facts.changelog.changelog_url,
      last_visible_update_date:
        facts.changelog.last_visible_update_date?.normalized_value ?? null,
      recent_update_titles: facts.changelog.recent_update_titles.map(
        (fact) => fact.normalized_value,
      ),
    },
  };
}

export function buildSnapshotAnalysis({
  pageType,
  scrape,
}: {
  pageType: PageType;
  scrape: ScrapedPage;
}): SnapshotAnalysis {
  const intelligence = analyzePageIntelligence({ pageType, scrape });
  const canonicalContent = normalizeForChangeDetection(scrape.rawText);
  const structuredFacts = compactPageIntelligence(intelligence);
  structuredFacts.availability = {
    ok: scrape.ok,
    fetch_status: scrape.status,
  };

  return {
    rawText: scrape.rawText,
    rawContentHash: hashValue(scrape.rawText),
    canonicalContent,
    canonicalContentHash: hashValue(canonicalContent),
    structuredFacts,
    structuredFactsHash: hashValue(stableStringify(hashableFacts(structuredFacts))),
    intelligence,
  };
}

export function buildUnavailableSnapshotAnalysis({
  pageType,
  scrape,
}: {
  pageType: PageType;
  scrape: ScrapedPage;
}): SnapshotAnalysis {
  const unavailableScrape = {
    ...scrape,
    rawText: "",
    hash: hashValue(""),
    ok: false,
  };

  return buildSnapshotAnalysis({ pageType, scrape: unavailableScrape });
}

export function snapshotFactsToJson(facts: SnapshotFacts): Json {
  return JSON.parse(JSON.stringify(facts)) as Json;
}

export function parseSnapshotFacts(value: Json | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<SnapshotFacts>;

  if (
    !candidate.page_type ||
    !candidate.availability ||
    !candidate.pricing ||
    !candidate.positioning ||
    !candidate.ctas ||
    !candidate.features ||
    !candidate.changelog
  ) {
    return null;
  }

  return candidate as SnapshotFacts;
}

function factEvidence(fact: SnapshotTextFact | SnapshotPrice | null | undefined) {
  return fact
    ? [{ source_url: fact.source_url, evidence_text: fact.evidence_text }]
    : [];
}

function priceKey(price: SnapshotPrice) {
  return [
    price.currency,
    Number(price.amount).toFixed(2),
    price.period ?? "",
    price.unit ?? "",
  ].join(":");
}

function formatPrice(price: SnapshotPrice) {
  const amount = Number.isInteger(price.amount)
    ? String(price.amount)
    : String(price.amount);
  const period = price.period ? `/${price.period}` : "";
  const unit = price.unit ? ` per ${price.unit}` : "";

  return `${price.currency} ${amount}${period}${unit}`;
}

function ctaKey(cta: SnapshotCta) {
  return [cta.intent, cta.normalized_value, cta.destination_url ?? ""].join(":");
}

function displayText(fact: SnapshotTextFact | SnapshotCta | null | undefined) {
  return fact?.value.trim() || "unknown";
}

function textSet(values: SnapshotTextFact[]) {
  return new Set(values.map((value) => value.normalized_value));
}

function addedValues(next: Set<string>, previous: Set<string>) {
  return Array.from(next).filter((value) => !previous.has(value));
}

function removedValues(next: Set<string>, previous: Set<string>) {
  return Array.from(previous).filter((value) => !next.has(value));
}

function tokenSimilarity(a: string, b: string) {
  const aTokens = new Set(a.split(/\s+/).filter((token) => token.length > 2));
  const bTokens = new Set(b.split(/\s+/).filter((token) => token.length > 2));

  if (!aTokens.size && !bTokens.size) {
    return 1;
  }

  const intersection = Array.from(aTokens).filter((token) => bTokens.has(token));
  const union = new Set([...aTokens, ...bTokens]);

  return intersection.length / union.size;
}

function meaningfullyDifferentText(
  previous: SnapshotTextFact | null,
  next: SnapshotTextFact | null,
) {
  if (!previous || !next) {
    return false;
  }

  if (previous.normalized_value === next.normalized_value) {
    return false;
  }

  return tokenSimilarity(previous.normalized_value, next.normalized_value) < 0.82;
}

function highestSeverity(changes: MeaningfulChange[]): Severity {
  if (changes.some((change) => change.severity === "high")) {
    return "high";
  }

  if (changes.some((change) => change.severity === "medium")) {
    return "medium";
  }

  return "low";
}

function compareAvailability(previous: SnapshotFacts, next: SnapshotFacts) {
  const changes: MeaningfulChange[] = [];

  if (previous.availability.ok && !next.availability.ok) {
    changes.push({
      category: "availability",
      changeType: "page_unavailable",
      summary: `${formatPageType(next.page_type)} page became unreachable${
        next.availability.fetch_status
          ? ` (HTTP ${next.availability.fetch_status})`
          : ""
      }.`,
      severity: next.page_type === "pricing" ? "high" : "medium",
      confidenceScore: 0.9,
      whyItMatters:
        "A monitored public page disappearing can change what prospects and competitors can verify.",
      evidence: [{ source_url: next.source_url, evidence_text: "Page fetch failed." }],
    });
  }

  if (!previous.availability.ok && next.availability.ok) {
    changes.push({
      category: "availability",
      changeType: "page_available",
      summary: `${formatPageType(next.page_type)} page became reachable again.`,
      severity: "low",
      confidenceScore: 0.84,
      whyItMatters:
        "Recovered public pages can restore pricing, positioning, or feature evidence.",
      evidence: [{ source_url: next.source_url, evidence_text: "Page fetch succeeded." }],
    });
  }

  return changes;
}

function comparePricing(previous: SnapshotFacts, next: SnapshotFacts) {
  const changes: MeaningfulChange[] = [];
  const previousLowest = previous.pricing.lowest_price;
  const nextLowest = next.pricing.lowest_price;
  const previousHighest = previous.pricing.highest_price;
  const nextHighest = next.pricing.highest_price;

  if (previousLowest && nextLowest && priceKey(previousLowest) !== priceKey(nextLowest)) {
    changes.push({
      category: "pricing",
      changeType: "lowest_price_changed",
      summary: `Lowest visible price changed from ${formatPrice(previousLowest)} to ${formatPrice(nextLowest)}.`,
      severity: "high",
      confidenceScore: Math.min(previousLowest.confidence_score, nextLowest.confidence_score),
      whyItMatters:
        "Entry pricing changes can affect how prospects compare plans and budgets.",
      evidence: [...factEvidence(previousLowest), ...factEvidence(nextLowest)],
    });
  }

  if (previousHighest && nextHighest && priceKey(previousHighest) !== priceKey(nextHighest)) {
    changes.push({
      category: "pricing",
      changeType: "highest_price_changed",
      summary: `Highest visible price changed from ${formatPrice(previousHighest)} to ${formatPrice(nextHighest)}.`,
      severity: "medium",
      confidenceScore: Math.min(previousHighest.confidence_score, nextHighest.confidence_score),
      whyItMatters:
        "Packaging movement can signal a shift in target account size or monetization.",
      evidence: [...factEvidence(previousHighest), ...factEvidence(nextHighest)],
    });
  }

  if (Boolean(previous.pricing.free_plan) !== Boolean(next.pricing.free_plan)) {
    const added = Boolean(next.pricing.free_plan);

    changes.push({
      category: "pricing",
      changeType: added ? "free_plan_added" : "free_plan_removed",
      summary: added ? "Free plan was added." : "Free plan was removed.",
      severity: "high",
      confidenceScore: 0.86,
      whyItMatters:
        "Free plan availability can change acquisition strategy and buyer expectations.",
      evidence: [
        ...factEvidence(previous.pricing.free_plan),
        ...factEvidence(next.pricing.free_plan),
      ],
    });
  }

  if (
    previous.pricing.paid_prices.length > 0 &&
    next.pricing.paid_prices.length === 0 &&
    next.pricing.contact_sales
  ) {
    changes.push({
      category: "pricing",
      changeType: "public_pricing_replaced_by_contact_sales",
      summary: "Public pricing was replaced by contact sales language.",
      severity: "high",
      confidenceScore: 0.84,
      whyItMatters:
        "Moving from public pricing to sales-led pricing can change buyer qualification and sales motion.",
      evidence: factEvidence(next.pricing.contact_sales),
    });
  }

  if (
    previous.pricing.contact_sales &&
    !next.pricing.contact_sales &&
    next.pricing.paid_prices.length > 0
  ) {
    changes.push({
      category: "pricing",
      changeType: "contact_sales_replaced_by_public_pricing",
      summary: "Contact sales pricing was replaced by public pricing.",
      severity: "high",
      confidenceScore: 0.84,
      whyItMatters:
        "Publishing prices can change conversion expectations and competitive comparisons.",
      evidence: next.pricing.paid_prices.flatMap(factEvidence),
    });
  }

  const previousPlans = textSet(previous.pricing.plan_names);
  const nextPlans = textSet(next.pricing.plan_names);
  const addedPlans = addedValues(nextPlans, previousPlans);
  const removedPlans = removedValues(nextPlans, previousPlans);

  if (addedPlans.length) {
    changes.push({
      category: "pricing",
      changeType: "pricing_plan_added",
      summary: `New pricing plan added: ${addedPlans[0]}.`,
      severity: "medium",
      confidenceScore: 0.72,
      whyItMatters:
        "New plans can signal packaging experiments or a new customer segment.",
      evidence: next.pricing.plan_names
        .filter((fact) => addedPlans.includes(fact.normalized_value))
        .flatMap(factEvidence),
    });
  }

  if (removedPlans.length) {
    changes.push({
      category: "pricing",
      changeType: "pricing_plan_removed",
      summary: `Pricing plan removed: ${removedPlans[0]}.`,
      severity: "medium",
      confidenceScore: 0.72,
      whyItMatters:
        "Removed plans can signal packaging cleanup or a changed go-to-market focus.",
      evidence: previous.pricing.plan_names
        .filter((fact) => removedPlans.includes(fact.normalized_value))
        .flatMap(factEvidence),
    });
  }

  return changes;
}

function compareCtas(previous: SnapshotFacts, next: SnapshotFacts) {
  const oldCta = previous.ctas.primary_cta;
  const newCta = next.ctas.primary_cta;

  if (!oldCta || !newCta || ctaKey(oldCta) === ctaKey(newCta)) {
    return [];
  }

  return [
    {
      category: "cta",
      changeType: "primary_cta_changed",
      summary: `Primary CTA changed from "${displayText(oldCta)}" to "${displayText(newCta)}".`,
      severity: "medium",
      confidenceScore: Math.min(oldCta.confidence_score, newCta.confidence_score),
      whyItMatters:
        "Primary CTA changes can indicate a shift in acquisition motion or conversion goal.",
      evidence: [...factEvidence(oldCta), ...factEvidence(newCta)],
    } satisfies MeaningfulChange,
  ];
}

function comparePositioning(previous: SnapshotFacts, next: SnapshotFacts) {
  const changes: MeaningfulChange[] = [];
  const fields: Array<{
    key: keyof SnapshotFacts["positioning"];
    label: string;
    type: string;
    severity: Severity;
  }> = [
    {
      key: "homepage_headline",
      label: "Homepage headline",
      type: "homepage_headline_changed",
      severity: "medium",
    },
    {
      key: "target_customer",
      label: "Target customer",
      type: "target_customer_changed",
      severity: "high",
    },
    {
      key: "product_category",
      label: "Product category",
      type: "product_category_changed",
      severity: "medium",
    },
    {
      key: "main_value_prop",
      label: "Main value proposition",
      type: "main_value_prop_changed",
      severity: "medium",
    },
  ];

  for (const field of fields) {
    const oldFact = previous.positioning[field.key];
    const newFact = next.positioning[field.key];

    if (
      !oldFact ||
      !newFact ||
      typeof oldFact === "string" ||
      typeof newFact === "string" ||
      !meaningfullyDifferentText(oldFact, newFact)
    ) {
      continue;
    }

    changes.push({
      category: "positioning",
      changeType: field.type,
      summary: `${field.label} changed from "${displayText(oldFact)}" to "${displayText(newFact)}".`,
      severity: field.severity,
      confidenceScore: Math.min(oldFact.confidence_score, newFact.confidence_score),
      whyItMatters:
        "Positioning changes can shift which buyers the competitor is trying to attract.",
      evidence: [...factEvidence(oldFact), ...factEvidence(newFact)],
    });
  }

  return changes;
}

function compareFeatures(previous: SnapshotFacts, next: SnapshotFacts) {
  const previousFeatures = new Set(previous.features.features.map((feature) => feature.name));
  const nextFeatures = new Set(next.features.features.map((feature) => feature.name));
  const added = addedValues(nextFeatures, previousFeatures);
  const removed = removedValues(nextFeatures, previousFeatures);
  const changes: MeaningfulChange[] = [];

  if (added.length) {
    const feature = next.features.features.find((item) => item.name === added[0]);

    changes.push({
      category: "features",
      changeType: "feature_added",
      summary: `New feature signal added: "${feature?.value ?? added[0]}".`,
      severity: "medium",
      confidenceScore: feature?.confidence_score ?? 0.68,
      whyItMatters:
        "New feature messaging can signal roadmap focus or a changed product emphasis.",
      evidence: factEvidence(feature),
    });
  }

  if (removed.length) {
    const feature = previous.features.features.find((item) => item.name === removed[0]);

    changes.push({
      category: "features",
      changeType: "feature_removed",
      summary: `Feature signal removed: "${feature?.value ?? removed[0]}".`,
      severity: "medium",
      confidenceScore: feature?.confidence_score ?? 0.68,
      whyItMatters:
        "Removed feature messaging can signal packaging or positioning changes.",
      evidence: factEvidence(feature),
    });
  }

  return changes;
}

function compareChangelog(previous: SnapshotFacts, next: SnapshotFacts) {
  const previousTitles = textSet(previous.changelog.recent_update_titles);
  const nextTitles = textSet(next.changelog.recent_update_titles);
  const newTitles = addedValues(nextTitles, previousTitles);
  const changes: MeaningfulChange[] = [];

  if (newTitles.length) {
    const title = next.changelog.recent_update_titles.find(
      (fact) => fact.normalized_value === newTitles[0],
    );

    changes.push({
      category: "changelog",
      changeType: "new_changelog_entry",
      summary: `New changelog entry detected: "${title?.value ?? newTitles[0]}".`,
      severity: "medium",
      confidenceScore: title?.confidence_score ?? 0.68,
      whyItMatters:
        "Release activity can reveal what the competitor is actively shipping.",
      evidence: factEvidence(title),
    });
  }

  const oldDate = previous.changelog.last_visible_update_date;
  const newDate = next.changelog.last_visible_update_date;

  if (
    oldDate &&
    newDate &&
    oldDate.normalized_value !== newDate.normalized_value &&
    !newTitles.length
  ) {
    changes.push({
      category: "changelog",
      changeType: "last_update_date_changed",
      summary: `Last visible update date changed from "${oldDate.value}" to "${newDate.value}".`,
      severity: "medium",
      confidenceScore: Math.min(oldDate.confidence_score, newDate.confidence_score),
      whyItMatters:
        "Updated release timing can signal recent product activity.",
      evidence: [...factEvidence(oldDate), ...factEvidence(newDate)],
    });
  }

  return changes;
}

function compareCanonicalContent(previousCanonical: string, nextCanonical: string, pageType: PageType) {
  const previousSegments = new Set(previousCanonical.split("\n").filter(Boolean));
  const nextSegments = new Set(nextCanonical.split("\n").filter(Boolean));
  const additions = addedValues(nextSegments, previousSegments);
  const removals = removedValues(nextSegments, previousSegments);
  const touched = [...additions, ...removals];
  const signalCount = touched.filter((line) => businessSignalPattern.test(line)).length;

  if (touched.length < 6 || signalCount < 2) {
    return [];
  }

  return [
    {
      category: "content",
      changeType: "substantial_content_changed",
      summary: `${formatPageType(pageType)} page had substantial business-copy changes.`,
      severity: pageType === "pricing" ? "medium" : "low",
      confidenceScore: 0.6,
      whyItMatters:
        "Large public copy changes can indicate messaging or offer movement even when specific facts are limited.",
      evidence: additions.slice(0, 2).map((line) => ({
        source_url: "",
        evidence_text: line,
      })),
    } satisfies MeaningfulChange,
  ];
}

export function compareSnapshotAnalyses({
  previousRawHash,
  previousCanonicalHash,
  previousStructuredFactsHash,
  previousFacts,
  previousCanonicalContent,
  current,
}: {
  previousRawHash: string | null;
  previousCanonicalHash: string | null;
  previousStructuredFactsHash: string | null;
  previousFacts: SnapshotFacts | null;
  previousCanonicalContent: string | null;
  current: SnapshotAnalysis;
}): SnapshotComparison {
  const rawChanged = previousRawHash !== current.rawContentHash;
  const canonicalChanged =
    previousCanonicalHash !== current.canonicalContentHash;
  const structuredFactsChanged =
    previousStructuredFactsHash !== current.structuredFactsHash;
  const ignoredReasons: string[] = [];
  const meaningfulChanges = previousFacts
    ? [
        ...compareAvailability(previousFacts, current.structuredFacts),
        ...comparePricing(previousFacts, current.structuredFacts),
        ...compareCtas(previousFacts, current.structuredFacts),
        ...comparePositioning(previousFacts, current.structuredFacts),
        ...compareFeatures(previousFacts, current.structuredFacts),
        ...compareChangelog(previousFacts, current.structuredFacts),
      ]
    : [];

  if (
    previousFacts &&
    canonicalChanged &&
    !meaningfulChanges.length &&
    previousCanonicalContent
  ) {
    meaningfulChanges.push(
      ...compareCanonicalContent(
        previousCanonicalContent,
        current.canonicalContent,
        current.structuredFacts.page_type,
      ),
    );
  }

  if (rawChanged && !canonicalChanged && !structuredFactsChanged) {
    ignoredReasons.push(
      "Raw text changed only; casing, whitespace, punctuation, boilerplate, or technical noise normalized away.",
    );
  }

  if (canonicalChanged && !structuredFactsChanged && !meaningfulChanges.length) {
    ignoredReasons.push("Canonical content changed, but no structured business facts changed.");
    ignoredReasons.push("Canonical difference was below the meaningful-change threshold.");
  }

  if (structuredFactsChanged && !meaningfulChanges.length) {
    ignoredReasons.push("Structured facts hash changed, but no specific user-facing business change passed confidence thresholds.");
  }

  return {
    rawChanged,
    canonicalChanged,
    structuredFactsChanged,
    meaningfulChanges: meaningfulChanges
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 4),
    ignoredReasons,
  };
}

export function createDetectedChangePayload(changes: MeaningfulChange[]) {
  const severity = highestSeverity(changes);
  const primary = changes[0];

  if (!primary) {
    return null;
  }

  const summary =
    changes.length === 1
      ? primary.summary
      : `${primary.summary} ${changes.length - 1} other meaningful change${
          changes.length === 2 ? "" : "s"
        } detected.`;

  return {
    diff_summary: `${summary} ${primary.whyItMatters}`,
    severity,
    change_type: primary.changeType,
    confidence_score: primary.confidenceScore,
    evidence_json: JSON.parse(JSON.stringify(primary.evidence)) as Json,
  };
}

export function formatPageType(pageType: PageType) {
  return pageType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
