import type { PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type {
  Confidence,
  NormalizedPrice,
  PricingAnalysis,
  StructuredFact,
} from "@/lib/intelligence/types";
import {
  makeFact,
  sentenceCaseKey,
  textLines,
  uniqueBy,
} from "@/lib/intelligence/text";

const currencyBySymbol: Record<string, NormalizedPrice["currency"]> = {
  $: "USD",
  "\u20AC": "EUR",
  "\u00A3": "GBP",
};

const currencyByCode: Record<string, NormalizedPrice["currency"]> = {
  eur: "EUR",
  usd: "USD",
  gbp: "GBP",
};

const symbolBeforePricePattern =
  /([$\u20AC\u00A3])\s?(\d{1,5}(?:[.,]\d{1,2})?)/gi;
const symbolAfterPricePattern =
  /(\d{1,5}(?:[.,]\d{1,2})?)\s?([$\u20AC\u00A3])/gi;
const codePricePattern =
  /(?:(usd|eur|gbp)\s?(\d{1,5}(?:[.,]\d{1,2})?)|(\d{1,5}(?:[.,]\d{1,2})?)\s?(usd|eur|gbp))/gi;
const freePattern =
  /\b(?:free forever|free plan|free tier|free trial|start free|free)\b/i;
const contactSalesPattern = /\b(?:contact sales|talk to sales|custom pricing|request pricing|enterprise pricing)\b/i;
const monthlyPattern = /\b(?:\/\s?mo|\/\s?month|per month|monthly|month)\b/i;
const yearlyPattern = /\b(?:\/\s?yr|\/\s?year|per year|annually|annual|yearly|billed annually)\b/i;
const unitPattern = /\b(?:per|\/)\s?(?:user|seat)\b/i;
const pricingContextPattern =
  /\b(?:pricing|price|plan|plans|package|packages|tier|starter|pro|team|business|enterprise|subscription|billing|billed|per month|monthly|annual|annually|seat|user)\b/i;

function parseAmount(value: string) {
  return Number(value.replace(",", "."));
}

function normalizedCurrency(symbolOrCode: string) {
  return (
    currencyBySymbol[symbolOrCode] ??
    currencyByCode[symbolOrCode.toLowerCase()]
  );
}

function periodForLine(line: string): NormalizedPrice["period"] | undefined {
  if (monthlyPattern.test(line)) {
    return "month";
  }

  if (yearlyPattern.test(line)) {
    return "year";
  }

  return undefined;
}

function unitForLine(line: string): NormalizedPrice["unit"] | undefined {
  return unitPattern.test(line) ? "user" : undefined;
}

function hasStrongPricingContext(line: string, pageType: PageType) {
  return pageType === "pricing" || pricingContextPattern.test(line);
}

function confidenceForPrice(line: string, pageType: PageType): {
  confidence: Confidence;
  confidenceScore: number;
} {
  const hasPeriod = Boolean(periodForLine(line));
  const hasContext = hasStrongPricingContext(line, pageType);

  if (hasPeriod && hasContext) {
    return { confidence: "high", confidenceScore: 0.92 };
  }

  if (hasContext) {
    return { confidence: "medium", confidenceScore: 0.74 };
  }

  return { confidence: "low", confidenceScore: 0.46 };
}

function priceFactsFromLine({
  line,
  pageType,
  sourceUrl,
}: {
  line: string;
  pageType: PageType;
  sourceUrl: string;
}) {
  const facts: StructuredFact<NormalizedPrice>[] = [];

  function addFact(matchText: string, amountText: string, currencyText: string) {
    const amount = parseAmount(amountText);
    const currency = normalizedCurrency(currencyText);

    if (!currency || Number.isNaN(amount)) {
      return;
    }

    const { confidence, confidenceScore } = confidenceForPrice(line, pageType);

    facts.push(
      makeFact<NormalizedPrice>({
        field: "visible_price",
        value: matchText.trim(),
        normalizedValue: {
          amount,
          currency,
          ...(periodForLine(line) ? { period: periodForLine(line) } : {}),
          ...(unitForLine(line) ? { unit: unitForLine(line) } : {}),
        },
        confidence,
        confidenceScore,
        sourceUrl,
        evidenceText: line,
        extractionMethod: "deterministic_regex",
      }),
    );
  }

  for (const match of line.matchAll(symbolBeforePricePattern)) {
    const currency = match[1];
    const amount = match[2];

    if (currency && amount) {
      addFact(match[0], amount, currency);
    }
  }

  for (const match of line.matchAll(symbolAfterPricePattern)) {
    const amount = match[1];
    const currency = match[2];

    if (currency && amount) {
      addFact(match[0], amount, currency);
    }
  }

  for (const match of line.matchAll(codePricePattern)) {
    const code = match[1] ?? match[4];
    const amount = match[2] ?? match[3];

    if (code && amount) {
      addFact(match[0], amount, code);
    }
  }

  return facts;
}

function candidatePlanName(line: string, previousLine?: string) {
  const beforePrice = line
    .split(/[$\u20AC\u00A3]|\b(?:usd|eur|gbp)\b/i)[0]
    .replace(/\b(?:starting at|from|only|just)\b/gi, "")
    .trim();

  if (
    beforePrice.length >= 2 &&
    beforePrice.length <= 40 &&
    !/\d/.test(beforePrice)
  ) {
    return beforePrice;
  }

  if (
    previousLine &&
    previousLine.length >= 2 &&
    previousLine.length <= 40 &&
    !/\d/.test(previousLine) &&
    !pricingContextPattern.test(previousLine)
  ) {
    return previousLine;
  }

  return null;
}

function planNameFacts({
  lines,
  priceFacts,
  sourceUrl,
}: {
  lines: string[];
  priceFacts: StructuredFact<NormalizedPrice>[];
  sourceUrl: string;
}) {
  const facts: StructuredFact[] = [];

  for (const priceFact of priceFacts) {
    const lineIndex = lines.findIndex(
      (line) => line === priceFact.evidence_text,
    );
    const line = lines[lineIndex] ?? priceFact.evidence_text;
    const planName = candidatePlanName(line, lines[lineIndex - 1]);

    if (!planName) {
      continue;
    }

    facts.push(
      makeFact({
        field: "plan_name",
        value: planName,
        confidence:
          priceFact.confidence === "high" ? "medium" : priceFact.confidence,
        confidenceScore: Math.min(priceFact.confidence_score, 0.72),
        sourceUrl,
        evidenceText: line,
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
    evidenceText: planNames[0]?.evidence_text ?? freePlan?.evidence_text ?? contactSales?.evidence_text ?? "",
    extractionMethod: "deterministic_regex",
  });
}

export function analyzePricing(
  scrape: ScrapedPage,
  pageType: PageType,
): PricingAnalysis {
  const sourceUrl = scrape.finalUrl;
  const lines = textLines(scrape);
  const priceFacts = uniqueBy(
    lines.flatMap((line) =>
      priceFactsFromLine({
        line,
        pageType,
        sourceUrl,
      }),
    ),
    (fact) =>
      `${fact.normalized_value?.currency}:${fact.normalized_value?.amount}:${fact.normalized_value?.period ?? ""}:${sentenceCaseKey(fact.evidence_text)}`,
  );
  const reliablePrices = priceFacts.filter(
    (fact) => fact.confidence !== "low" || pageType === "pricing",
  );
  const freeLine = lines.find((line) => freePattern.test(line));
  const contactSalesLine = lines.find((line) => contactSalesPattern.test(line));
  const freePlan = freeLine
    ? makeFact({
        field: "free_plan",
        value: "Free plan detected",
        confidence: hasStrongPricingContext(freeLine, pageType)
          ? "high"
          : "medium",
        confidenceScore: hasStrongPricingContext(freeLine, pageType)
          ? 0.9
          : 0.72,
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
  const paidPlans = [...reliablePrices].sort(
    (a, b) => priceSortValue(a) - priceSortValue(b),
  );
  const planNames = planNameFacts({ lines, priceFacts: paidPlans, sourceUrl });
  const pricingTierCount = tierCountFact({
    planNames,
    freePlan,
    contactSales,
    sourceUrl,
  });
  const warnings: string[] = [];

  if (!paidPlans.length && !freePlan && !contactSales) {
    warnings.push("No public pricing detected.");
  }

  if (priceFacts.length > reliablePrices.length) {
    warnings.push("Some weak pricing-like matches were ignored.");
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
  };
}
