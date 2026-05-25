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

function scoreOutOfTen(value: number) {
  return Math.max(0, Math.min(10, Number(value.toFixed(1))));
}

function specificTitleScore(title: string) {
  const normalized = title.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const hasSpecificAction =
    /\b(?:test|make|clarify|surface|reduce|compare|add|show|replace|tighten)\b/i.test(
      title,
    );
  const generic =
    ["improve cta", "add pricing", "clarify positioning"].includes(normalized) ||
    words.length < 4;

  return generic ? 3 : hasSpecificAction ? 9 : 7;
}

function displayTierForRecommendationValue(score: number) {
  if (score >= 60) {
    return "prioritize";
  }

  if (score >= 52) {
    return "show";
  }

  if (score >= 45) {
    return "hide";
  }

  return "reject";
}

function recommendationTrust(recommendation: ProductRecommendationDraft) {
  const evidence = recommendation.evidence_json;

  if (!isRecord(evidence)) {
    return {};
  }

  return isRecord(evidence.trust) ? evidence.trust : {};
}

function recommendationValueScore(recommendation: ProductRecommendationDraft) {
  return numberOrDefault(
    recommendationTrust(recommendation).recommendation_value_score,
    0,
  );
}

function recommendationNovelty(recommendation: ProductRecommendationDraft) {
  return numberOrDefault(
    recommendationTrust(recommendation).novelty_score,
    0,
  );
}

function recommendationPriority(recommendation: ProductRecommendationDraft) {
  return numberOrDefault(
    recommendationTrust(recommendation).priority_score,
    0,
  );
}

function recommendationValueTier(recommendation: ProductRecommendationDraft) {
  const tier = recommendationTrust(recommendation).recommendation_value_tier;

  return typeof tier === "string" ? tier : "reject";
}

function isActionableHighValueRecommendation(
  recommendation: ProductRecommendationDraft,
) {
  const trust = recommendationTrust(recommendation);
  const adversarialReview = trust.adversarial_review;
  const survives =
    isRecord(adversarialReview) && adversarialReview.survives === true;

  return (
    recommendation.confidence >= 75 &&
    recommendationValueScore(recommendation) >= 60 &&
    recommendationNovelty(recommendation) >= 0.6 &&
    recommendationPriority(recommendation) >= 35 &&
    recommendationValueTier(recommendation) === "prioritize" &&
    survives
  );
}

function recommendationValueReview({
  type,
  title,
  explanation,
  userFact,
  supports,
  score,
  novelty,
  priority,
  actionability,
}: {
  type: string;
  title: string;
  explanation: string;
  userFact: StructuredFact;
  supports: CompetitorSupport[];
  score: number;
  novelty: number;
  priority: number;
  actionability: "medium" | "high";
}) {
  const evidenceCount = supports.length + 1;
  const specificity = specificTitleScore(title);
  const evidence = scoreOutOfTen(
    Math.min(10, evidenceCount * 1.7 + averageSupportConfidence(supports) * 4),
  );
  const actionabilityValue = scoreOutOfTen(actionabilityScore(actionability) * 10);
  const noveltyValue = scoreOutOfTen(novelty * 10);
  const businessImpact = scoreOutOfTen(impactScore(type) * 10);
  const founderUsefulness = scoreOutOfTen(
    priority / 15 + Math.min(3, supports.length) + specificity / 4,
  );
  const confidenceValue = scoreOutOfTen(score / 10);
  const total = Math.round(
    specificity +
      evidence +
      actionabilityValue +
      noveltyValue +
      businessImpact +
      founderUsefulness +
      confidenceValue,
  );
  const competitorValues = Array.from(
    new Set(supports.map((support) => support.fact.value.trim()).filter(Boolean)),
  );
  const survives =
    total >= 45 &&
    evidence >= 6 &&
    confidenceValue >= 6 &&
    competitorValues.length > 0 &&
    reliable(userFact);

  return {
    total,
    max: 70,
    display_tier: displayTierForRecommendationValue(total),
    components: {
      specificity,
      evidence,
      actionability: actionabilityValue,
      novelty: noveltyValue,
      business_impact: businessImpact,
      founder_usefulness: founderUsefulness,
      confidence: confidenceValue,
    },
    adversarial_review: {
      supporting_argument: `${supports.length} competitor baseline${
        supports.length === 1 ? "" : "s"
      } and one user-product fact support this recommendation.`,
      counterargument:
        "Competitor behavior may not fit this product's market, pricing motion, or conversion model.",
      missing_evidence:
        "No analytics, user interviews, or A/B-test outcome data is available inside LaunchRadar.",
      alternative_explanation:
        "The difference may reflect a deliberate go-to-market strategy rather than a weakness.",
      survives,
    },
    implementability: {
      what_changes: title,
      why: explanation,
      expected_impact:
        "A clearer public-page test with lower visitor decision friction.",
      difficulty:
        actionability === "high"
          ? "Low to medium: copy/layout test"
          : "Medium: positioning decision required",
      time_estimate:
        actionability === "high" ? "1-3 hours for a page experiment" : "1-2 days for a focused messaging pass",
    },
  };
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

  const valueReview = recommendationValueReview({
    type,
    title,
    explanation,
    userFact,
    supports,
    score,
    novelty,
    priority,
    actionability,
  });

  if (
    valueReview.total < 55 ||
    valueReview.display_tier === "reject" ||
    !valueReview.adversarial_review.survives
  ) {
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
        recommendation_value_score: valueReview.total,
        recommendation_value_max: valueReview.max,
        recommendation_value_components: valueReview.components,
        recommendation_value_tier: valueReview.display_tier,
        adversarial_review: valueReview.adversarial_review,
        implementability: valueReview.implementability,
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

function createBaselineRecommendation({
  type,
  title,
  explanation,
  whyThisMatters,
  userFact,
  actionability = "high",
}: {
  type: string;
  title: string;
  explanation: string;
  whyThisMatters: string;
  userFact: StructuredFact;
  actionability?: "medium" | "high";
}): ProductRecommendationDraft | null {
  if (!reliable(userFact)) {
    return null;
  }

  const score = Math.min(88, Math.round(68 + userFact.confidence_score * 18));
  const priority = priorityScore({ type, confidence: score, actionability });
  const novelty = 0.68;

  if (score < 75 || priority < 35) {
    return null;
  }

  return {
    recommendation_type: type,
    title,
    explanation,
    why_this_matters: whyThisMatters,
    evidence_json: {
      user_evidence: [evidenceFromUser(userFact)],
      competitor_evidence: [],
      observation: userFact.value,
      interpretation:
        "This is a baseline opportunity from the user's public page evidence. It does not require competitor consensus.",
      reasoning:
        "LaunchRadar found a clear user-page signal that can be made more conversion-specific without relying on guesses.",
      recommendation: title,
      trust: {
        confidence: score,
        confidence_label: confidenceLabel(score),
        actionability_score: actionabilityScore(actionability),
        impact_score: impactScore(type),
        effort_score: effortScore(type),
        novelty_score: novelty,
        priority_score: priority,
        visibility: visibilityForConfidence(score),
        consensus: {
          supporting_competitors: 0,
          required_competitors: 0,
          average_confidence: 0,
          satisfied: true,
        },
        recommendation_value_score: 62,
        recommendation_value_max: 70,
        recommendation_value_components: {
          specificity: 8,
          evidence: 7,
          actionability: scoreOutOfTen(actionabilityScore(actionability) * 10),
          novelty: scoreOutOfTen(novelty * 10),
          business_impact: scoreOutOfTen(impactScore(type) * 10),
          founder_usefulness: 8,
          confidence: scoreOutOfTen(score / 10),
        },
        recommendation_value_tier: "prioritize",
        adversarial_review: {
          supporting_argument:
            "The recommendation is grounded in a verified public-page fact from the user's own product.",
          counterargument:
            "Without competitor or analytics data, this should be treated as a high-confidence copy/layout test rather than a guaranteed conversion win.",
          missing_evidence:
            "No conversion analytics or user research is available inside LaunchRadar.",
          alternative_explanation:
            "The current page may intentionally optimize for a different sales motion.",
          survives: true,
        },
        implementability: {
          what_changes: title,
          why: explanation,
          expected_impact:
            "Clearer public-page decision signals for visitors evaluating the product.",
          difficulty:
            actionability === "high"
              ? "Low to medium: copy/layout test"
              : "Medium: positioning decision required",
          time_estimate:
            actionability === "high"
              ? "1-3 hours for a focused page test"
              : "1-2 days for a messaging pass",
        },
      },
      trend: {
        status: "baseline_only",
        time_window: "latest_baseline",
        note: "This recommendation uses current verified baseline facts only.",
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

function baselinePricingRecommendation(
  input: ProductRecommendationInput,
): ProductRecommendationDraft | null {
  const visiblePrice = bestFact(input.productFacts, [
    "visible_price",
    "lowest_price",
    "pricing_plan",
    "free_plan",
  ]);
  const contactSales = bestFact(input.productFacts, ["contact_sales"]);
  const pricingVisibility = bestFact(input.productFacts, ["pricing_visibility"]);

  if (visiblePrice || ["public", "partially_public"].includes(pricingVisibility?.value ?? "")) {
    return null;
  }

  const evidence = contactSales ?? pricingVisibility;

  if (!evidence) {
    return null;
  }

  return createBaselineRecommendation({
    type: "pricing_visibility",
    title: "Clarify the pricing path visitors should take",
    explanation:
      contactSales
        ? "Your page shows a sales-led pricing path. Make that path explicit with who should contact sales and what happens next."
        : "LaunchRadar could not verify public pricing from your current page evidence. Add a clear pricing signal or explicitly route buyers to sales.",
    whyThisMatters:
      "Pricing ambiguity can slow qualified visitors. The safer action is to clarify the path, not invent a price.",
    userFact: evidence,
  });
}

function baselineCtaRecommendation(
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

  const intent = ctaIntent(userCta);
  const unclear =
    userCta.field === "cta_funnel_intent"
      ? userCta.value === "unclear"
      : intent === "unknown" || passiveCtaPattern.test(userCta.value);

  if (!unclear) {
    return null;
  }

  return createBaselineRecommendation({
    type: "cta_clarity",
    title: "Make the main CTA describe the next step",
    explanation:
      "Your detected CTA is passive or unclear. Replace it with the action visitors should take now, such as starting, signing up, booking, or viewing pricing.",
    whyThisMatters:
      "A clear CTA reduces decision friction and is easy to test without changing the product.",
    userFact: userCta,
  });
}

function baselinePositioningRecommendation(
  input: ProductRecommendationInput,
): ProductRecommendationDraft | null {
  const headline = bestFact(input.productFacts, [
    "homepage_headline",
    "main_value_prop",
    "subheadline",
  ]);
  const specific = bestFact(input.productFacts, [
    "target_customer",
    "target_customer_model",
    "product_category",
    "market_category",
    "key_use_case",
  ]);

  if (!headline || specific) {
    return null;
  }

  return createBaselineRecommendation({
    type: "positioning_specificity",
    title: "Add a sharper audience or use-case signal",
    explanation:
      "LaunchRadar found a headline or value statement, but not a clear target customer, category, or use case.",
    whyThisMatters:
      "Specific positioning helps visitors decide faster whether the product is for them.",
    userFact: headline,
    actionability: "medium",
  });
}

export function buildProductRecommendations(
  input: ProductRecommendationInput,
): ProductRecommendationDraft[] {
  const competitorRecommendations = [
    pricingVisibilityRecommendation(input),
    ctaRecommendation(input),
    positioningRecommendation(input),
  ].filter((item): item is ProductRecommendationDraft => Boolean(item));
  const baselineRecommendations =
    input.competitorSnapshots.length === 0
      ? [
          baselinePricingRecommendation(input),
          baselineCtaRecommendation(input),
          baselinePositioningRecommendation(input),
        ].filter((item): item is ProductRecommendationDraft => Boolean(item))
      : [];
  const recommendations = [
    ...competitorRecommendations,
    ...baselineRecommendations,
  ];

  return recommendations
    .filter(isActionableHighValueRecommendation)
    .sort(
      (a, b) =>
        recommendationValueScore(b) - recommendationValueScore(a) ||
        recommendationPriority(b) - recommendationPriority(a) ||
        b.confidence - a.confidence,
    )
    .slice(0, 3);
}
