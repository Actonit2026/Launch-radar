import type { PageBlockType } from "@/lib/crawler/text";
import type { PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type {
  Confidence,
  NormalizedPrice,
  PricingAnalysis,
  PricingCandidateDebug,
  StructuredFact,
} from "@/lib/intelligence/types";
import {
  analysisBlocks,
  blockText,
  makeFact,
  sentenceCaseKey,
  textLines,
  uniqueBy,
} from "@/lib/intelligence/text";

type PriceCandidate = {
  rawText: string;
  amount: number;
  currency: NormalizedPrice["currency"];
  period?: NormalizedPrice["period"];
  unit?: NormalizedPrice["unit"];
  plan?: string;
  evidenceText: string;
  context: string;
  section: PageBlockType;
  score: number;
  reasons: string[];
  rejected?: string;
};

const currencyBySymbol: Record<string, NormalizedPrice["currency"]> = {
  $: "USD",
  "\u20AC": "EUR",
  "â‚¬": "EUR",
  "\u00A3": "GBP",
  "Â£": "GBP",
};

const currencyByCode: Record<string, NormalizedPrice["currency"]> = {
  eur: "EUR",
  usd: "USD",
  gbp: "GBP",
};

const pricePatterns = [
  /([$\u20AC\u00A3]|â‚¬|Â£)\s?(\d{1,5}(?:[.,]\d{1,2})?)/gi,
  /(\d{1,5}(?:[.,]\d{1,2})?)\s?([$\u20AC\u00A3]|â‚¬|Â£)/gi,
  /(?:(usd|eur|gbp)\s?(\d{1,5}(?:[.,]\d{1,2})?)|(\d{1,5}(?:[.,]\d{1,2})?)\s?(usd|eur|gbp))/gi,
];
const freePattern =
  /\b(?:free forever|free plan|free tier|free trial|start free|free)\b/i;
const contactSalesPattern =
  /\b(?:contact sales|talk to sales|custom pricing|request pricing|enterprise pricing)\b/i;
const weakContactSalesPattern =
  /\b(?:contact us|book a demo|request a quote|request quote|sales-led pricing)\b/i;
const monthlyPattern =
  /\b(?:\/\s?mo|\/\s?month|per month|monthly|billed monthly|paid monthly|month)\b/i;
const yearlyPattern =
  /\b(?:\/\s?yr|\/\s?year|per year|annually|annual|yearly|billed annually)\b/i;
const unitPattern = /\b(?:per|\/)\s?(?:user|seat)\b/i;
const planPattern =
  /\b(?:free|starter|basic|plus|pro|premium|team|business|growth|enterprise|upgrade|plan|package|tier)\b/i;
const pricingContextPattern =
  /\b(?:pricing|price|prices|plan|plans|package|packages|tier|starter|basic|plus|pro|premium|team|business|enterprise|subscription|billing|billed|paid|monthly|annual|annually|upgrade|checkout|seat|user)\b/i;
const ctaContextPattern =
  /\b(?:get plus|get pro|upgrade|start free|sign up|subscribe|get started|buy|checkout|choose plan)\b/i;
const statRejectPattern =
  /\b(?:customers|users|visitors|uptime|support|founded|employees|integrations|templates|examples|reviews|stars|rating|raised|funding|revenue|arr|mrr|million|billion|downloads)\b|%/i;

function parseAmount(value: string) {
  return Number(value.replace(",", "."));
}

function normalizedCurrency(symbolOrCode: string) {
  return (
    currencyBySymbol[symbolOrCode] ??
    currencyByCode[symbolOrCode.toLowerCase()]
  );
}

function periodForContext(context: string): NormalizedPrice["period"] | undefined {
  if (monthlyPattern.test(context)) {
    return "month";
  }

  if (yearlyPattern.test(context)) {
    return "year";
  }

  return undefined;
}

function unitForContext(context: string): NormalizedPrice["unit"] | undefined {
  return unitPattern.test(context) ? "user" : undefined;
}

function planForContext(context: string, heading?: string | null) {
  const headingPlan =
    heading && heading.length <= 48 && planPattern.test(heading)
      ? heading.trim()
      : null;

  if (headingPlan) {
    return headingPlan;
  }

  const linePlan = context.match(
    /\b(Free|Starter|Basic|Plus|Pro|Premium|Team|Business|Growth|Enterprise)\b/i,
  )?.[1];

  return linePlan ?? undefined;
}

function confidenceFromScore(score: number): Confidence {
  if (score >= 80) {
    return "high";
  }

  if (score >= 60) {
    return "medium";
  }

  return "low";
}

function boundedScore(score: number) {
  return Math.min(100, Math.max(0, score));
}

function factScore(candidate: PriceCandidate) {
  return Number((boundedScore(candidate.score) / 100).toFixed(2));
}

function lineWindow(lines: string[], index: number) {
  return lines.slice(Math.max(0, index - 1), index + 2).join(" ");
}

function scoreCandidate({
  context,
  section,
  pageType,
  rawText,
}: {
  context: string;
  section: PageBlockType;
  pageType: PageType;
  rawText: string;
}) {
  let score = 50;
  const reasons = ["currency"];

  if (planPattern.test(context)) {
    score += 20;
    reasons.push("plan_context");
  }

  if (monthlyPattern.test(context) || yearlyPattern.test(context)) {
    score += 20;
    reasons.push("billing_context");
  }

  if (ctaContextPattern.test(context)) {
    score += 15;
    reasons.push("cta_nearby");
  }

  if (section === "pricing" || pageType === "pricing") {
    score += 15;
    reasons.push("pricing_section");
  }

  if (pricingContextPattern.test(context)) {
    score += 10;
    reasons.push("pricing_language");
  }

  if (statRejectPattern.test(context) && !pricingContextPattern.test(context)) {
    score -= 35;
    reasons.push("stat_context_penalty");
  }

  if (/\b(?:m|mm|b|bn)\b/i.test(rawText)) {
    score -= 25;
    reasons.push("funding_or_large_number_penalty");
  }

  return { score: boundedScore(score), reasons };
}

function candidateDebug(
  candidate: PriceCandidate,
  sourceUrl: string,
): PricingCandidateDebug {
  return {
    raw_text: candidate.rawText,
    context: candidate.context.slice(0, 420),
    source_url: sourceUrl,
    section: candidate.section,
    score: candidate.score,
    accepted: !candidate.rejected,
    reasons: candidate.reasons,
    ...(candidate.rejected ? { rejection_reason: candidate.rejected } : {}),
  };
}

function candidatesFromContext({
  context,
  section,
  pageType,
  heading,
}: {
  context: string;
  section: PageBlockType;
  pageType: PageType;
  heading?: string | null;
}) {
  const candidates: PriceCandidate[] = [];

  for (const pattern of pricePatterns) {
    pattern.lastIndex = 0;

    for (const match of context.matchAll(pattern)) {
      const first = match[1];
      const second = match[2];
      const third = match[3];
      const fourth = match[4];
      const currencyText =
        normalizedCurrency(first ?? "") ? first : normalizedCurrency(second ?? "") ? second : first ?? fourth;
      const amountText =
        normalizedCurrency(first ?? "") ? second : normalizedCurrency(second ?? "") ? first : second ?? third;
      const currency = currencyText ? normalizedCurrency(currencyText) : null;
      const amount = amountText ? parseAmount(amountText) : Number.NaN;

      if (!currency || !Number.isFinite(amount)) {
        continue;
      }

      const scoring = scoreCandidate({
        context,
        section,
        pageType,
        rawText: match[0],
      });
      const rejected =
        scoring.score < 40
          ? "confidence_below_threshold"
          : amount <= 0
            ? "non_positive_amount"
            : undefined;

      candidates.push({
        rawText: match[0].trim(),
        amount,
        currency,
        period: periodForContext(context),
        unit: unitForContext(context),
        plan: planForContext(context, heading),
        evidenceText: context,
        context,
        section,
        score: scoring.score,
        reasons: scoring.reasons,
        rejected,
      });
    }
  }

  if (
    !candidates.length &&
    /(?:\bplus\b|\bpro\b|\bupgrade\b|\bplan\b)/i.test(context) &&
    /\b\d{1,5}(?:[.,]\d{1,2})?\b/.test(context)
  ) {
    candidates.push({
      rawText: context.match(/\b\d{1,5}(?:[.,]\d{1,2})?\b/)?.[0] ?? "",
      amount: Number.NaN,
      currency: "EUR",
      evidenceText: context,
      context,
      section,
      score: 25,
      reasons: ["strong_plan_context_without_currency"],
      rejected: "missing_currency",
    });
  }

  return candidates.map((candidate) => ({
    ...candidate,
    evidenceText: candidate.evidenceText.replace(/\s+/g, " ").trim(),
  }));
}

function priceFact({
  candidate,
  sourceUrl,
}: {
  candidate: PriceCandidate;
  sourceUrl: string;
}) {
  const normalizedValue: NormalizedPrice = {
    amount: candidate.amount,
    currency: candidate.currency,
    ...(candidate.period ? { period: candidate.period } : {}),
    ...(candidate.unit ? { unit: candidate.unit } : {}),
    ...(candidate.plan ? { plan: candidate.plan } : {}),
  };

  return makeFact<NormalizedPrice>({
    field: "visible_price",
    value: candidate.rawText,
    normalizedValue,
    confidence: confidenceFromScore(candidate.score),
    confidenceScore: factScore(candidate),
    sourceUrl,
    evidenceText: candidate.evidenceText,
    extractionMethod: "deterministic_regex",
  });
}

function candidatePlanName(candidate: PriceCandidate, previousLine?: string) {
  if (candidate.plan) {
    return candidate.plan;
  }

  const beforePrice = candidate.context
    .split(/[$\u20AC\u00A3]|â‚¬|Â£|\b(?:usd|eur|gbp)\b/i)[0]
    .replace(/\b(?:starting at|from|only|just|get|choose)\b/gi, "")
    .trim();

  if (
    beforePrice.length >= 2 &&
    beforePrice.length <= 48 &&
    !/\d/.test(beforePrice) &&
    planPattern.test(beforePrice)
  ) {
    return beforePrice;
  }

  if (
    previousLine &&
    previousLine.length >= 2 &&
    previousLine.length <= 48 &&
    !/\d/.test(previousLine) &&
    planPattern.test(previousLine)
  ) {
    return previousLine;
  }

  return null;
}

function planNameFacts({
  lines,
  candidates,
  sourceUrl,
}: {
  lines: string[];
  candidates: PriceCandidate[];
  sourceUrl: string;
}) {
  const facts: StructuredFact[] = [];

  for (const candidate of candidates) {
    const lineIndex = lines.findIndex((line) =>
      candidate.context.includes(line),
    );
    const planName = candidatePlanName(candidate, lines[lineIndex - 1]);

    if (!planName) {
      continue;
    }

    facts.push(
      makeFact({
        field: "plan_name",
        value: planName,
        confidence: candidate.score >= 80 ? "high" : "medium",
        confidenceScore: Math.min(factScore(candidate), 0.82),
        sourceUrl,
        evidenceText: candidate.evidenceText,
        extractionMethod: "deterministic_regex",
      }),
    );
  }

  return uniqueBy(facts, (fact) => sentenceCaseKey(fact.value));
}

function priceSortValue(fact: StructuredFact<NormalizedPrice>) {
  const price = fact.normalized_value;

  if (!price) {
    return Number.POSITIVE_INFINITY;
  }

  const yearlyDivisor = price.period === "year" ? 12 : 1;

  return price.amount / yearlyDivisor;
}

function tierCountFact({
  planNames,
  freePlan,
  contactSales,
  sourceUrl,
}: {
  planNames: StructuredFact[];
  freePlan: StructuredFact | null;
  contactSales: StructuredFact | null;
  sourceUrl: string;
}) {
  const count =
    planNames.length + (freePlan ? 1 : 0) + (contactSales ? 1 : 0);

  if (!count) {
    return null;
  }

  return makeFact<number>({
    field: "pricing_tier_count",
    value: String(count),
    normalizedValue: count,
    confidence: planNames.length ? "medium" : "low",
    confidenceScore: planNames.length ? 0.68 : 0.42,
    sourceUrl,
    evidenceText:
      planNames[0]?.evidence_text ??
      freePlan?.evidence_text ??
      contactSales?.evidence_text ??
      "",
    extractionMethod: "deterministic_regex",
  });
}

function pricingContexts(scrape: ScrapedPage, pageType: PageType) {
  const blocks = analysisBlocks(scrape, ["pricing", "hero", "cta"]);
  const contexts = blocks.map((block) => ({
    context: blockText(block),
    section: block.type,
    heading: block.heading,
  }));

  if (!scrape.pageModel?.blocks.length) {
    const lines = textLines(scrape);

    lines.forEach((line, index) => {
      contexts.push({
        context: lineWindow(lines, index),
        section: pageType === "pricing" ? "pricing" : "unknown",
        heading: null,
      });
    });
  }

  return contexts.filter((item) => item.context.trim());
}

export function analyzePricing(
  scrape: ScrapedPage,
  pageType: PageType,
): PricingAnalysis {
  const sourceUrl = scrape.finalUrl;
  const lines = textLines(scrape);
  const allCandidates = pricingContexts(scrape, pageType).flatMap((item) =>
    candidatesFromContext({
      context: item.context,
      section: item.section,
      pageType,
      heading: item.heading,
    }),
  );
  const acceptedCandidates = allCandidates.filter(
    (candidate) => !candidate.rejected,
  );
  const priceFacts = uniqueBy(
    acceptedCandidates.map((candidate) => priceFact({ candidate, sourceUrl })),
    (fact) =>
      `${fact.normalized_value?.currency}:${fact.normalized_value?.amount}:${fact.normalized_value?.period ?? ""}:${sentenceCaseKey(fact.evidence_text)}`,
  );
  const paidPlans = [...priceFacts].sort(
    (a, b) => priceSortValue(a) - priceSortValue(b),
  );
  const freeLine = lines.find((line) => freePattern.test(line));
  const hasPricingContext =
    pageType === "pricing" || lines.some((line) => pricingContextPattern.test(line));
  const contactSalesLine =
    lines.find((line) => contactSalesPattern.test(line)) ??
    (hasPricingContext
      ? lines.find((line) => weakContactSalesPattern.test(line))
      : undefined);
  const freePlan = freeLine
    ? makeFact({
        field: "free_plan",
        value: "Free plan detected",
        confidence: pricingContextPattern.test(freeLine) ? "high" : "medium",
        confidenceScore: pricingContextPattern.test(freeLine) ? 0.9 : 0.72,
        sourceUrl,
        evidenceText: freeLine,
        extractionMethod: "deterministic_regex",
      })
    : null;
  const contactSales = contactSalesLine
    ? makeFact({
        field: "contact_sales",
        value: "Contact sales",
        confidence: "high",
        confidenceScore: 0.88,
        sourceUrl,
        evidenceText: contactSalesLine,
        extractionMethod: "deterministic_regex",
      })
    : null;
  const planNames = planNameFacts({
    lines,
    candidates: acceptedCandidates,
    sourceUrl,
  });
  const pricingTierCount = tierCountFact({
    planNames,
    freePlan,
    contactSales,
    sourceUrl,
  });
  const debugCandidates = allCandidates.map((candidate) =>
    candidateDebug(candidate, sourceUrl),
  );
  const selectedDebug = paidPlans[0]
    ? debugCandidates.find(
        (candidate) => candidate.raw_text === paidPlans[0]?.value,
      ) ?? null
    : null;
  const warnings: string[] = [];

  if (!paidPlans.length && !freePlan && !contactSales) {
    warnings.push("No public pricing block detected on this URL.");
  }

  if (allCandidates.some((candidate) => candidate.rejected)) {
    warnings.push("Some pricing-like matches were rejected. See pricing debug.");
  }

  return {
    status:
      paidPlans.length || freePlan || contactSales ? "found" : "unavailable",
    facts: [
      ...paidPlans,
      ...(freePlan ? [freePlan] : []),
      ...(contactSales ? [contactSales] : []),
      ...(pricingTierCount ? [pricingTierCount] : []),
      ...planNames,
    ],
    freePlan,
    paidPlans,
    lowestPrice: paidPlans[0] ?? null,
    highestPrice: paidPlans[paidPlans.length - 1] ?? null,
    contactSales,
    pricingTierCount,
    planNames,
    warnings,
    debug: {
      candidates: debugCandidates,
      selected_candidate: selectedDebug,
      rejected_candidates: debugCandidates.filter(
        (candidate) => !candidate.accepted,
      ),
    },
  };
}
