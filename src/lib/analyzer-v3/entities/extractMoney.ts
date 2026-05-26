import type { AnalyzerEntity, BlockRole, EvidenceBlock, MoneyValue } from "@/lib/analyzer-v3/types";

const currencyBySymbol: Record<string, MoneyValue["currency"]> = {
  "$": "USD",
  "\u20ac": "EUR",
  "\u00a3": "GBP",
  "\u00e2\u201a\u00ac": "EUR",
  "\u00c2\u00a3": "GBP",
};
const currencyByCode: Record<string, MoneyValue["currency"]> = {
  usd: "USD",
  eur: "EUR",
  gbp: "GBP",
};
const amountPattern = String.raw`(?:\d{1,3}(?:[,\s]\d{3})+(?:[.,]\d{1,2})?|\d{1,5}(?:[.,]\d{1,2})?)`;
const pricePatterns = [
  new RegExp(`([$\\u20ac\\u00a3]|\\u00e2\\u201a\\u00ac|\\u00c2\\u00a3)\\s?(${amountPattern})`, "gi"),
  new RegExp(`(${amountPattern})\\s?([$\\u20ac\\u00a3]|\\u00e2\\u201a\\u00ac|\\u00c2\\u00a3)`, "gi"),
  new RegExp(`(?:(usd|eur|gbp)\\s?(${amountPattern})|(${amountPattern})\\s?(usd|eur|gbp))`, "gi"),
];
const positiveRoles = new Set<BlockRole>([
  "pricing_section",
  "pricing_card",
  "pricing_table",
  "plan_comparison",
  "billing_toggle",
  "upgrade_modal",
  "checkout_section",
]);
const negativeRoles = new Set<BlockRole>([
  "testimonial",
  "case_study",
  "customer_story",
  "example_output",
  "proposal_sample",
  "job_example",
  "blog_content",
  "footer",
  "navigation",
  "legal",
]);

function parseAmount(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/,/g, "");
  return Number.parseFloat(normalized);
}

function currency(value: string | undefined) {
  if (!value) return null;
  return currencyBySymbol[value] ?? currencyByCode[value.toLowerCase()] ?? null;
}

function period(text: string): MoneyValue["period"] {
  if (/\b(?:\/\s?mo|\/\s?month|per month|monthly|month)\b/i.test(text)) return "month";
  if (/\b(?:\/\s?yr|\/\s?year|per year|yearly|annual|annually|year)\b/i.test(text)) return "year";
  if (/\b(?:\/\s?wk|\/\s?week|per week|weekly|week)\b/i.test(text)) return "week";
  if (/\b(?:usage|pageviews?|requests?|events?)\b/i.test(text)) return "usage";
  return "unknown";
}

function unit(text: string): MoneyValue["unit"] | undefined {
  if (/\b(?:per|\/)\s?(?:user|seat)\b/i.test(text)) {
    return "user";
  }

  return undefined;
}

function confidence(score: number) {
  if (score >= 0.8) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

function contextWindow(text: string, index: number, length: number) {
  const lineStart = Math.max(0, text.lastIndexOf("\n", Math.max(0, index - 1)) + 1);
  const lineEndIndex = text.indexOf("\n", index + length);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  const line = text.slice(lineStart, lineEnd).replace(/\s+/g, " ").trim();
  const previousStart = Math.max(0, text.lastIndexOf("\n", Math.max(0, lineStart - 2)) + 1);
  const nextEndIndex = text.indexOf("\n", lineEnd + 1);
  const nextEnd = nextEndIndex === -1 ? text.length : nextEndIndex;

  if (
    line.length >= 8 &&
    line.length <= 220 &&
    !/^(?:[$\u20ac\u00a3]|\u00e2\u201a\u00ac|\u00c2\u00a3|usd|eur|gbp)?\s?\d[\d,.]*\s?(?:[$\u20ac\u00a3]|\u00e2\u201a\u00ac|\u00c2\u00a3|usd|eur|gbp)?\s?(?:\/\s?(?:mo|month|yr|year)|per\s+(?:month|year))?$/i.test(line)
  ) {
    return line;
  }

  const localLines = text.slice(previousStart, nextEnd).replace(/\s+/g, " ").trim();

  if (localLines.length >= 8 && localLines.length <= 260) {
    return localLines;
  }

  return text.slice(Math.max(0, index - 120), index + length + 160).replace(/\s+/g, " ").trim();
}

function scoreMoney(block: EvidenceBlock, context: string) {
  let score = 0.48;
  const reasons: string[] = ["currency_near_amount"];

  if (positiveRoles.has(block.role)) {
    score += 0.28;
    reasons.push(`eligible_role:${block.role}`);
  }

  if (block.page_type === "pricing") {
    score += 0.12;
    reasons.push("pricing_page");
  }

  if (/\b(?:monthly|yearly|annually|per month|per year|\/mo|\/month|billing)\b/i.test(context)) {
    score += 0.12;
    reasons.push("billing_period");
  }

  if (/\b(?:starter|plus|pro|business|enterprise|free|plan|tier|package)\b/i.test(context)) {
    score += 0.1;
    reasons.push("plan_context");
  }

  if (/\b(?:subscribe|upgrade|get started|start free|choose plan|buy|get plus|get pro)\b/i.test(context)) {
    score += 0.08;
    reasons.push("purchase_cta");
  }

  if (/\b(?:customers|users|uptime|support|integrations|reviews|stars|founded|employees|downloads)\b|%/i.test(context)) {
    score -= 0.3;
    reasons.push("stat_context");
  }

  if (/\b(?:example|sample|proposal|job|budget|case study|testimonial|client|article|upwork|freelancer|quote|per hour|\/hr)\b/i.test(context)) {
    score -= 0.55;
    reasons.push("negative_business_context");
  }

  if (negativeRoles.has(block.role)) {
    score = Math.min(score, 0.2);
    reasons.push(`negative_role:${block.role}`);
  }

  return {
    score: Number(Math.max(0, Math.min(1, score)).toFixed(2)),
    reasons,
  };
}

export function extractMoney(blocks: EvidenceBlock[]) {
  const entities: AnalyzerEntity<MoneyValue>[] = [];

  blocks.forEach((block) => {
    const planWordCount = (block.text.match(/\b(?:free|starter|basic|plus|pro|team|business|growth|enterprise)\b/gi) ?? []).length;

    if (
      !block.table_shape &&
      ["pricing_card", "pricing_section"].includes(block.role) &&
      /^pricing|choose your plan|simple,? transparent pricing/i.test(block.local_heading ?? "") &&
      planWordCount >= 2
    ) {
      return;
    }

    for (const pattern of pricePatterns) {
      pattern.lastIndex = 0;

      for (const match of block.text.matchAll(pattern)) {
        const firstCurrency = currency(match[1]);
        const secondCurrency = currency(match[2]);
        const fourthCurrency = currency(match[4]);
        const detectedCurrency = firstCurrency ?? secondCurrency ?? fourthCurrency;
        const amountText = firstCurrency ? match[2] : secondCurrency ? match[1] : match[2] ?? match[3];
        const amount = amountText ? parseAmount(amountText) : Number.NaN;

        if (!detectedCurrency || !Number.isFinite(amount) || amount <= 0) {
          continue;
        }

        const index = match.index ?? 0;
        const evidenceText = contextWindow(block.text, index, match[0].length);
        const scoring = scoreMoney(block, evidenceText);
        const accepted = scoring.score >= 0.8;
        const partial = scoring.score >= 0.6 && scoring.score < 0.8;

        entities.push({
          id: `${block.id}:money:${entities.length}`,
          type: "money",
          value: match[0].trim(),
          normalized_value: {
            amount,
            currency: detectedCurrency,
            period: period(evidenceText),
            ...(unit(evidenceText) ? { unit: unit(evidenceText) } : {}),
          },
          source_block_id: block.id,
          source_url: block.final_url,
          evidence_text: evidenceText,
          context_role: block.role,
          confidence: confidence(scoring.score),
          confidence_score: scoring.score,
          accepted,
          rejection_reason: accepted
            ? null
            : partial
              ? "score_between_unclear_and_accepted"
              : scoring.reasons.includes("negative_business_context") || scoring.reasons.some((reason) => reason.startsWith("negative_role"))
                ? "negative_context_beats_price_signal"
                : "pricing_context_score_below_threshold",
        });
      }
    }
  });

  return entities;
}
