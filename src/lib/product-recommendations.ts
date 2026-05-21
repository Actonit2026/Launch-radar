import type { Json } from "@/lib/database.types";
import type { CtaIntent, StructuredFact } from "@/lib/intelligence/types";

export type RecommendationConfidenceLabel =
  | "very_low"
  | "low"
  | "medium"
  | "high"
  | "very_high";

export type ProductRecommendationInput = {
  productFacts: StructuredFact[];
  competitorSnapshots: Array<{
    competitorName: string;
    facts: StructuredFact[];
  }>;
};

export type ProductRecommendationDraft = {
  recommendation_type: string;
  title: string;
  explanation: string;
  why_this_matters: string;
  evidence_json: Json;
  confidence: number;
  confidence_label: RecommendationConfidenceLabel;
  actionability: "medium" | "high";
};

type EvidenceItem = {
  type: "user_product" | "competitor";
  competitor_name?: string;
  field: string;
  value: string;
  source_url: string;
  evidence_text: string;
};

type CompetitorSupport = {
  competitorName: string;
  fact: StructuredFact;
};

const passiveCtaPattern =
  /\b(learn more|read more|explore|discover|see how|view more)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function confidence(value: unknown): StructuredFact["confidence"] {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : "low";
}

function parseFact(value: unknown): StructuredFact | null {
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
    normalized_value: value.normalized_value,
    confidence: confidence(value.confidence),
    confidence_score: numberOrDefault(value.confidence_score, 0),
    source_url: sourceUrl,
    evidence_text: evidenceText,
    extraction_method: extractionMethod as StructuredFact["extraction_method"],
  };
}

export function parseStructuredFacts(value: Json): StructuredFact[] {
  return Array.isArray(value)
    ? value.map(parseFact).filter((fact): fact is StructuredFact => Boolean(fact))
    : [];
}

function reliable(fact: StructuredFact) {
  return fact.confidence !== "low" && fact.confidence_score >= 0.55;
}

function byConfidence(a: StructuredFact, b: StructuredFact) {
  return b.confidence_score - a.confidence_score;
}

function factsByField(facts: StructuredFact[], field: string) {
  return facts.filter((fact) => fact.field === field);
}

function bestFact(facts: StructuredFact[], fields: string[]) {
  return fields
    .flatMap((field) => factsByField(facts, field))
    .filter(reliable)
    .sort(byConfidence)[0];
}

function ctaIntent(fact: StructuredFact | undefined): CtaIntent | null {
  if (!fact || !isRecord(fact.normalized_value)) {
    return null;
  }

  const intent = fact.normalized_value.intent;

  return typeof intent === "string" ? (intent as CtaIntent) : null;
}

function competitorSupportByField(
  snapshots: ProductRecommendationInput["competitorSnapshots"],
  fields: string[],
) {
  return snapshots
    .map((snapshot) => {
      const fact = bestFact(snapshot.facts, fields);

      return fact ? { competitorName: snapshot.competitorName, fact } : null;
    })
    .filter((item): item is CompetitorSupport => Boolean(item));
}

function hasConsensus(supports: CompetitorSupport[]) {
  if (supports.length >= 2) {
    return true;
  }

  const only = supports[0]?.fact;

  return Boolean(
    only && only.confidence === "high" && only.confidence_score >= 0.92,
  );
}

function evidenceFromUser(fact: StructuredFact): EvidenceItem {
  return {
    type: "user_product",
    field: fact.field,
    value: fact.value,
    source_url: fact.source_url,
    evidence_text: fact.evidence_text,
  };
}

function evidenceFromCompetitors(supports: CompetitorSupport[]) {
  return supports.slice(0, 4).map((support): EvidenceItem => ({
    type: "competitor",
    competitor_name: support.competitorName,
    field: support.fact.field,
    value: support.fact.value,
    source_url: support.fact.source_url,
    evidence_text: support.fact.evidence_text,
  }));
}

function confidenceLabel(score: number): RecommendationConfidenceLabel {
  if (score >= 90) {
    return "very_high";
  }

  if (score >= 75) {
    return "high";
  }

  if (score >= 60) {
    return "medium";
  }

  if (score >= 40) {
    return "low";
  }

  return "very_low";
}

function recommendationConfidence(
  userFact: StructuredFact,
  supports: CompetitorSupport[],
) {
  const averageCompetitorConfidence =
    supports.reduce((sum, support) => sum + support.fact.confidence_score, 0) /
    Math.max(1, supports.length);
  const raw =
    48 +
    Math.min(supports.length, 4) * 9 +
    userFact.confidence_score * 14 +
    averageCompetitorConfidence * 20;

  return Math.min(96, Math.round(raw));
}

function createRecommendation({
  type,
  title,
  explanation,
  whyThisMatters,
  userFact,
  supports,
  reasoning,
  actionability = "high",
}: {
  type: string;
  title: string;
  explanation: string;
  whyThisMatters: string;
  userFact: StructuredFact;
  supports: CompetitorSupport[];
  reasoning: string;
  actionability?: "medium" | "high";
}): ProductRecommendationDraft | null {
  if (!hasConsensus(supports)) {
    return null;
  }

  const score = recommendationConfidence(userFact, supports);

  if (score < 60) {
    return null;
  }

  return {
    recommendation_type: type,
    title,
    explanation,
    why_this_matters: whyThisMatters,
    evidence_json: {
      user_evidence: [evidenceFromUser(userFact)],
      competitor_evidence: evidenceFromCompetitors(supports),
      observation: supports
        .slice(0, 3)
        .map((support) => `${support.competitorName}: ${support.fact.value}`)
        .join("; "),
      interpretation: reasoning,
      reasoning,
    },
    confidence: score,
    confidence_label: confidenceLabel(score),
    actionability,
  };
}

function pricingVisibilityRecommendation(
  input: ProductRecommendationInput,
): ProductRecommendationDraft | null {
  const visiblePrice = bestFact(input.productFacts, ["visible_price"]);

  if (visiblePrice) {
    return null;
  }

  const userContactSales =
    bestFact(input.productFacts, ["contact_sales"]) ??
    bestFact(input.productFacts, ["primary_cta", "secondary_cta"]);

  if (!userContactSales) {
    return null;
  }

  const intent = ctaIntent(userContactSales);

  if (
    userContactSales.field !== "contact_sales" &&
    intent !== "contact_sales" &&
    !/contact|demo|sales/i.test(userContactSales.value)
  ) {
    return null;
  }

  const supports = competitorSupportByField(input.competitorSnapshots, [
    "visible_price",
    "free_plan",
  ]);

  return createRecommendation({
    type: "pricing_visibility",
    title: "Test whether public pricing would reduce sales friction",
    explanation:
      "Your public page points visitors toward contacting sales or booking a conversation, while tracked competitors expose pricing or a free plan on public pages.",
    whyThisMatters:
      "Public pricing can reduce evaluation friction for self-serve buyers, but this is only worth testing if it fits your sales motion.",
    userFact: userContactSales,
    supports,
    reasoning:
      "Pricing visibility appears in competitor evidence, while the user product evidence points to a contact-sales path instead of a visible price.",
  });
}

function ctaRecommendation(
  input: ProductRecommendationInput,
): ProductRecommendationDraft | null {
  const userCta = bestFact(input.productFacts, [
    "primary_cta",
    "secondary_cta",
  ]);

  if (!userCta) {
    return null;
  }

  const userIntent = ctaIntent(userCta);
  const userIsPassive =
    userIntent === "unknown" || passiveCtaPattern.test(userCta.value);

  if (!userIsPassive) {
    return null;
  }

  const clearIntents = new Set<CtaIntent>([
    "start_trial",
    "sign_up",
    "book_demo",
    "get_started",
  ]);
  const supports = input.competitorSnapshots
    .map((snapshot) => {
      const fact = bestFact(snapshot.facts, ["primary_cta"]);
      const intent = ctaIntent(fact);

      return fact && intent && clearIntents.has(intent)
        ? { competitorName: snapshot.competitorName, fact }
        : null;
    })
    .filter((item): item is CompetitorSupport => Boolean(item));

  return createRecommendation({
    type: "cta_clarity",
    title: "Make the primary CTA a clearer next step",
    explanation:
      "Your detected primary CTA is passive or unclear, while tracked competitors use direct trial, signup, or demo actions.",
    whyThisMatters:
      "A decisive CTA can reduce decision friction by making the next action obvious. This does not guarantee higher conversion, but it is a low-effort test.",
    userFact: userCta,
    supports,
    reasoning:
      "Competitor CTAs show clearer conversion intent than the user product CTA detected from public page evidence.",
  });
}

function positioningRecommendation(
  input: ProductRecommendationInput,
): ProductRecommendationDraft | null {
  const userHeadline = bestFact(input.productFacts, [
    "homepage_headline",
    "main_value_prop",
  ]);
  const userSpecificPositioning = bestFact(input.productFacts, [
    "target_customer",
    "product_category",
    "key_use_case",
  ]);

  if (!userHeadline || userSpecificPositioning) {
    return null;
  }

  const supports = competitorSupportByField(input.competitorSnapshots, [
    "target_customer",
    "product_category",
    "main_value_prop",
  ]);

  return createRecommendation({
    type: "positioning_specificity",
    title: "Clarify who the homepage is for",
    explanation:
      "Your homepage evidence gives a headline or value statement, but LaunchRadar did not detect a clear customer, category, or use case. Tracked competitors state more specific positioning signals.",
    whyThisMatters:
      "Specific positioning can help visitors quickly decide whether the product is relevant. The evidence supports a clarity test, not a claim that the current positioning is wrong.",
    userFact: userHeadline,
    supports,
    reasoning:
      "Competitors provide clearer customer/category/use-case signals than the user product facts detected from public page evidence.",
    actionability: "medium",
  });
}

export function buildProductRecommendations(
  input: ProductRecommendationInput,
): ProductRecommendationDraft[] {
  const recommendations = [
    pricingVisibilityRecommendation(input),
    ctaRecommendation(input),
    positioningRecommendation(input),
  ].filter((item): item is ProductRecommendationDraft => Boolean(item));

  return recommendations
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}
