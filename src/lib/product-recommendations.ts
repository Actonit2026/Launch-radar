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
  const requirement = consensusRequirement(supports);

  return supports.length >= requirement;
}

function averageSupportConfidence(supports: CompetitorSupport[]) {
  return (
    supports.reduce((sum, support) => sum + support.fact.confidence_score, 0) /
    Math.max(1, supports.length)
  );
}

function consensusRequirement(supports: CompetitorSupport[]) {
  const average = averageSupportConfidence(supports);

  if (average >= 0.9) {
    return 1;
  }

  if (average >= 0.75) {
    return 2;
  }

  if (average >= 0.6) {
    return 3;
  }

  return 4;
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
  const averageCompetitorConfidence = averageSupportConfidence(supports);
  const raw =
    48 +
    Math.min(supports.length, 4) * 9 +
    userFact.confidence_score * 14 +
    averageCompetitorConfidence * 20;

  return Math.min(96, Math.round(raw));
}

function actionabilityScore(actionability: "medium" | "high") {
  return actionability === "high" ? 0.86 : 0.68;
}

function impactScore(type: string) {
  switch (type) {
    case "pricing_visibility":
      return 0.78;
    case "cta_clarity":
      return 0.72;
    case "positioning_specificity":
      return 0.76;
    default:
      return 0.62;
  }
}

function effortScore(type: string) {
  switch (type) {
    case "cta_clarity":
      return 0.34;
    case "positioning_specificity":
      return 0.5;
    case "pricing_visibility":
      return 0.64;
    default:
      return 0.7;
  }
}

function noveltyScore({
  title,
  supports,
}: {
  title: string;
  supports: CompetitorSupport[];
}) {
  const genericTitles = [
    "improve cta",
    "add pricing",
    "clarify positioning",
    "improve onboarding",
    "add features",
  ];
  const normalizedTitle = title.toLowerCase();

  if (genericTitles.some((generic) => normalizedTitle === generic)) {
    return 0.2;
  }

  const distinctSignals = new Set(
    supports.map((support) => support.fact.value.toLowerCase().trim()),
  ).size;

  return Math.min(0.94, 0.54 + distinctSignals * 0.12 + supports.length * 0.06);
}

function priorityScore({
  type,
  confidence,
  actionability,
}: {
  type: string;
  confidence: number;
  actionability: "medium" | "high";
}) {
  const priority =
    ((actionabilityScore(actionability) *
      impactScore(type) *
      (confidence / 100)) /
      effortScore(type)) *
    100;

  return Math.min(100, Math.round(priority));
}

function visibilityForConfidence(score: number) {
  if (score >= 90) {
    return "highlight";
  }

  if (score >= 75) {
    return "normal";
  }

  return "collapsed";
}

function competitorConsensusSummary(supports: CompetitorSupport[]) {
  const requirement = consensusRequirement(supports);

  return {
    supporting_competitors: supports.length,
    required_competitors: requirement,
    average_confidence: Number(averageSupportConfidence(supports).toFixed(2)),
    satisfied: supports.length >= requirement,
  };
}

function comparisonCount(supports: CompetitorSupport[], totalCompetitors: number) {
  return `${supports.length} out of ${totalCompetitors} tracked competitors`;
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
  const novelty = noveltyScore({ title, supports });
  const priority = priorityScore({
    type,
    confidence: score,
    actionability,
  });

  if (score < 60 || novelty < 0.6 || priority < 35) {
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
      recommendation: title,
      trust: {
        confidence: score,
        confidence_label: confidenceLabel(score),
        actionability_score: actionabilityScore(actionability),
        impact_score: impactScore(type),
        effort_score: effortScore(type),
        novelty_score: Number(novelty.toFixed(2)),
        priority_score: priority,
        visibility: visibilityForConfidence(score),
        consensus: competitorConsensusSummary(supports),
      },
      trend: {
        status: "insufficient_history",
        time_window: "latest_baselines",
        note: "Trend confidence requires future scan history; this recommendation uses current verified baselines only.",
      },
    },
    confidence: score,
    confidence_label: confidenceLabel(score),
    actionability,
  };
}

function pricingVisibilityRecommendation(
  input: ProductRecommendationInput,
): ProductRecommendationDraft | null {
  const visiblePrice = bestFact(input.productFacts, [
    "visible_price",
    "lowest_price",
    "pricing_plan",
  ]);
  const userPricingVisibility = bestFact(input.productFacts, [
    "pricing_visibility",
  ]);

  if (
    visiblePrice ||
    ["public", "partially_public"].includes(userPricingVisibility?.value ?? "")
  ) {
    return null;
  }

  const userContactSales =
    bestFact(input.productFacts, ["contact_sales"]) ??
    (userPricingVisibility?.value === "contact_sales"
      ? userPricingVisibility
      : null) ??
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

  const supports = input.competitorSnapshots
    .map((snapshot) => {
      const visibility = bestFact(snapshot.facts, ["pricing_visibility"]);
      const pricingPlan = bestFact(snapshot.facts, [
        "pricing_plan",
        "visible_price",
        "lowest_price",
        "free_plan",
      ]);

      if (
        visibility &&
        ["public", "partially_public"].includes(visibility.value)
      ) {
        return { competitorName: snapshot.competitorName, fact: visibility };
      }

      return pricingPlan
        ? { competitorName: snapshot.competitorName, fact: pricingPlan }
        : null;
    })
    .filter((item): item is CompetitorSupport => Boolean(item));
  const count = comparisonCount(supports, input.competitorSnapshots.length);

  return createRecommendation({
    type: "pricing_visibility",
    title: "Test whether public pricing would reduce sales friction",
    explanation:
      `${count} display public pricing or a free plan. Your public page points visitors toward contacting sales or booking a conversation instead.`,
    whyThisMatters:
      "Public pricing can reduce evaluation friction for self-serve buyers, but this is only worth testing if it fits your sales motion.",
    userFact: userContactSales,
    supports,
    reasoning:
      `${count} provide pricing visibility evidence, while the user product evidence points to a contact-sales path instead of a visible price.`,
  });
}

function ctaRecommendation(
  input: ProductRecommendationInput,
): ProductRecommendationDraft | null {
  const userCta = bestFact(input.productFacts, [
    "primary_cta",
    "secondary_cta",
    "cta_funnel_intent",
  ]);

  if (!userCta) {
    return null;
  }

  const userIntent = ctaIntent(userCta);
  const userIsPassive =
    userCta.field === "cta_funnel_intent"
      ? userCta.value === "unclear"
      : userIntent === "unknown" || passiveCtaPattern.test(userCta.value);

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
      const funnel = bestFact(snapshot.facts, ["cta_funnel_intent"]);
      const intent = ctaIntent(fact);

      if (funnel && ["self_serve", "hybrid"].includes(funnel.value)) {
        return { competitorName: snapshot.competitorName, fact: funnel };
      }

      return fact && intent && clearIntents.has(intent)
        ? { competitorName: snapshot.competitorName, fact }
        : null;
    })
    .filter((item): item is CompetitorSupport => Boolean(item));
  const count = comparisonCount(supports, input.competitorSnapshots.length);

  return createRecommendation({
    type: "cta_clarity",
    title: "Make the primary CTA a clearer next step",
    explanation:
      `${count} use direct trial, signup, get-started, or demo CTAs. Your detected primary CTA is passive or unclear.`,
    whyThisMatters:
      "A decisive CTA can reduce decision friction by making the next action obvious. This does not guarantee higher conversion, but it is a low-effort test.",
    userFact: userCta,
    supports,
    reasoning:
      `${count} show clearer conversion intent than the user product CTA detected from public page evidence.`,
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
    "target_customer_model",
    "product_category",
    "market_category",
    "key_use_case",
  ]);

  if (!userHeadline || userSpecificPositioning) {
    return null;
  }

  const supports = competitorSupportByField(input.competitorSnapshots, [
    "target_customer",
    "target_customer_model",
    "product_category",
    "market_category",
    "main_value_prop",
  ]);
  const count = comparisonCount(supports, input.competitorSnapshots.length);

  return createRecommendation({
    type: "positioning_specificity",
    title: "Clarify who the homepage is for",
    explanation:
      `${count} state clearer customer, category, or value-prop signals. Your homepage evidence gives a headline or value statement, but LaunchRadar did not detect a clear customer, category, or use case.`,
    whyThisMatters:
      "Specific positioning can help visitors quickly decide whether the product is relevant. The evidence supports a clarity test, not a claim that the current positioning is wrong.",
    userFact: userHeadline,
    supports,
    reasoning:
      `${count} provide clearer customer/category/use-case signals than the user product facts detected from public page evidence.`,
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
  const sorted = recommendations.sort((a, b) => b.confidence - a.confidence);
  const keepCount =
    sorted.length <= 1 ? sorted.length : Math.max(1, Math.floor(sorted.length * 0.7));

  return sorted.slice(0, keepCount).slice(0, 3);
}
