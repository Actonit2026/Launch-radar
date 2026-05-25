import * as cheerio from "cheerio";
import type { PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type {
  Confidence,
  ModelEvidence,
  NormalizedPrice,
  PricingEnterpriseOption,
  PricingModel,
  PricingPlanModel,
  PricingUsageTierModel,
} from "@/lib/intelligence/types";
import {
  analysisBlocks,
  blockText,
  sentenceCaseKey,
  textLines,
  uniqueBy,
} from "@/lib/intelligence/text";
import {
  classifyPricingContext,
  hasReliablePricingPlanLabel,
  parsePriceAmount,
} from "@/lib/intelligence/pricing-context";

type CheerioElement = Parameters<cheerio.CheerioAPI>[0];

type ParsedPrice = {
  raw: string;
  amount: number;
  currency: NormalizedPrice["currency"];
  billing_period: PricingPlanModel["billing_period"];
  billing_mode: PricingPlanModel["billing_mode"];
};

const currencyBySymbol: Record<string, NormalizedPrice["currency"]> = {
  $: "USD",
  "\u20AC": "EUR",
  "Ã¢â€šÂ¬": "EUR",
  "\u00A3": "GBP",
  "Ã‚Â£": "GBP",
};
const currencyByCode: Record<string, NormalizedPrice["currency"]> = {
  eur: "EUR",
  usd: "USD",
  gbp: "GBP",
};
const planNamePattern =
  /\b(Free|Starter|Start|Basic|Plus|Pro|Professional|Premium|Team|Teams|Business|Growth|Scale|Enterprise|Custom|Agency|Creator|Launch|Personal|Core)\b/i;
const contactPattern =
  /\b(?:contact sales|contact us|talk to sales|custom pricing|request pricing|enterprise|custom)\b/i;
const pricingContextPattern =
  /\b(?:pricing|price|prices|plans?|tiers?|package|billing|monthly|yearly|annually|pageviews?|seats?|users?|requests?|usage|calculator|slider)\b/i;
const ctaPattern =
  /\b(?:start free|start trial|get started|sign up|buy|upgrade|subscribe|contact us|contact sales|talk to sales|view pricing|choose plan)\b/i;
const verifiedPricingStructurePattern =
  /\b(?:pricing table|pricing card|plan card|plans?|billing toggle|upgrade|subscription|checkout|choose plan|monthly|yearly|annually|get plus|get pro|get business|start free|buy now|pageviews?|seats?|users?|requests?|usage|calculator|slider)\b/i;
const contaminatedPricePattern =
  /\b(?:job|salary|budget|freelance|freelancer|contractor|hiring|client project|project budget|hourly|per hour|\/\s?hr|\bhr\b|upwork|example|sample|template|generated output|generated proposal|proposal sample|sample proposal|article|blog post|copywriting|per article|testimonial|customer story|case study)\b/i;

function normalizeText(value: string) {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function currencyFor(value: string) {
  return currencyBySymbol[value] ?? currencyByCode[value.toLowerCase()] ?? null;
}

function billingPeriodFor(text: string): PricingPlanModel["billing_period"] {
  if (/\b(?:\/\s?mo|\/\s?month|per month|monthly|month)\b/i.test(text)) {
    return "month";
  }

  if (/\b(?:\/\s?yr|\/\s?year|per year|yearly|annual|annually)\b/i.test(text)) {
    return "year";
  }

  if (/\b(?:\/\s?wk|\/\s?week|per week|weekly)\b/i.test(text)) {
    return "week";
  }

  return "unknown";
}

function billingModeFor(
  period: PricingPlanModel["billing_period"],
): PricingPlanModel["billing_mode"] {
  if (period === "month") return "monthly";
  if (period === "year") return "yearly";
  if (period === "week") return "weekly";
  if (period === "usage") return "usage";

  return "unknown";
}

function isProductPricingText(
  text: string,
  context: { domContext?: string; section?: string; pageType?: PageType } = {},
) {
  const classified = classifyPricingContext({
    text,
    domContext: context.domContext,
    section: context.section,
    pageType: context.pageType,
  });
  const verified =
    classified.accepted ||
    verifiedPricingStructurePattern.test(text) ||
    ctaPattern.test(text) ||
    (pricingContextPattern.test(text) && planNamePattern.test(text));

  return verified && !(!classified.accepted && contaminatedPricePattern.test(text));
}

function parsePrices(
  text: string,
  context: { domContext?: string; section?: string; pageType?: PageType } = {},
): ParsedPrice[] {
  const normalized = normalizeText(text);

  if (!isProductPricingText(normalized, context)) {
    return [];
  }

  const amount = String.raw`(?:\d{1,3}(?:[,\s]\d{3})+(?:[.,]\d{1,2})?|\d{1,5}(?:[.,]\d{1,2})?)`;
  const patterns = [
    new RegExp(`([$\\u20AC\\u00A3]|Ã¢â€šÂ¬|Ã‚Â£)\\s?(${amount})`, "gi"),
    new RegExp(`(${amount})\\s?([$\\u20AC\\u00A3]|Ã¢â€šÂ¬|Ã‚Â£)`, "gi"),
    new RegExp(
      `(?:(usd|eur|gbp)\\s?(${amount})|(${amount})\\s?(usd|eur|gbp))`,
      "gi",
    ),
  ];
  const prices: ParsedPrice[] = [];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;

    for (const match of normalized.matchAll(pattern)) {
      const first = match[1];
      const second = match[2];
      const third = match[3];
      const fourth = match[4];
      const firstCurrency = first ? currencyFor(first) : null;
      const secondCurrency = second ? currencyFor(second) : null;
      const currency = firstCurrency ?? secondCurrency ?? currencyFor(first ?? fourth ?? "");
      const amountText = firstCurrency ? second : secondCurrency ? first : second ?? third;
      const amount = amountText ? parsePriceAmount(amountText) : Number.NaN;

      if (!currency || !Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      const matchIndex = match.index ?? 0;
      const nearby = normalized.slice(
        Math.max(0, matchIndex - 90),
        matchIndex + match[0].length + 120,
      );
      const billing_period = billingPeriodFor(nearby);

      prices.push({
        raw: match[0].trim(),
        amount,
        currency,
        billing_period,
        billing_mode: billingModeFor(billing_period),
      });
    }
  }

  return uniqueBy(
    prices,
    (price) =>
      `${price.currency}:${price.amount}:${price.billing_period}:${price.raw}`,
  );
}

function evidence({
  sourceUrl,
  text,
  section,
  confidence = "medium",
}: {
  sourceUrl: string;
  text: string;
  section: string;
  confidence?: Confidence;
}): ModelEvidence {
  return {
    source_url: sourceUrl,
    evidence_text: normalizeText(text).slice(0, 260),
    section,
    confidence,
  };
}

function textForElement(
  $: cheerio.CheerioAPI,
  element: CheerioElement,
) {
  const clone = $(element).clone();

  clone
    .find("br,p,h1,h2,h3,h4,li,button,a,summary,td,th,label,span")
    .after("\n");

  return clone
    .text()
    .split(/\n+/)
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");
}

function allDomLines($: cheerio.CheerioAPI) {
  return $("body")
    .text()
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9$€£])/)
    .map(normalizeText)
    .filter(Boolean);
}

function planNameFromText(text: string, fallback: string | null = null) {
  const lines = text.split(/\n+/).map(normalizeText).filter(Boolean);
  const explicit = text.match(planNamePattern)?.[1];

  if (explicit) {
    return explicit === "Start" ? "Starter" : explicit;
  }

  const heading = lines.find(
    (line) =>
      line.length >= 2 &&
      line.length <= 48 &&
      !/[.?!]/.test(line) &&
      !/\d{2,}/.test(line) &&
      !ctaPattern.test(line),
  );

  if (heading && hasReliablePricingPlanLabel(heading)) {
    return heading;
  }

  return fallback && hasReliablePricingPlanLabel(fallback) ? fallback : null;
}

function limitFromText(text: string) {
  const normalized = normalizeText(text);
  const patterns = [
    /\b(?:up to|over|from)\s+[\d,.]+\s?(?:k|m|million|thousand)?\+?\s+(?:monthly\s+)?(?:pageviews?|users?|seats?|requests?|events?|visits?|sites?)\b/i,
    /\b[\d,.]+\s?(?:k|m|million|thousand)?\+?\s+(?:monthly\s+)?(?:pageviews?|users?|seats?|requests?|events?|visits?|sites?)\b/i,
    /\bone\s+site\b/i,
    /\bunlimited\s+(?:sites?|users?|seats?|events?|pageviews?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern)?.[0];

    if (match) {
      return normalizeText(match);
    }
  }

  return null;
}

function unitFromLimit(limit: string | null) {
  if (!limit) return null;

  return limit.match(/\b(pageviews?|users?|seats?|requests?|events?|visits?|sites?)\b/i)?.[1]?.toLowerCase() ?? null;
}

function billingModesFromText(text: string): PricingModel["billing_modes"] {
  const modes: PricingModel["billing_modes"] = [];

  if (/\b(?:monthly|per month|\/mo|month)\b/i.test(text)) modes.push("monthly");
  if (/\b(?:yearly|annual|annually|per year|\/yr|year)\b/i.test(text)) modes.push("yearly");
  if (/\b(?:weekly|per week|\/wk|week)\b/i.test(text)) modes.push("weekly");
  if (/\b(?:usage|pageviews?|requests?|events?|slider|calculator)\b/i.test(text)) modes.push("usage");
  if (contactPattern.test(text)) modes.push("custom");

  return uniqueBy(modes, (mode) => mode);
}

function ctaFromElement($: cheerio.CheerioAPI, element: CheerioElement) {
  const cta = $(element)
    .find("button,a,[role='button']")
    .map((_, item) => normalizeText($(item).text()))
    .get()
    .find((text) => text.length <= 60 && ctaPattern.test(text));

  return cta ?? null;
}

function includedFeaturesFromText(text: string) {
  return text
    .split(/\n+/)
    .map(normalizeText)
    .filter(
      (line) =>
        line.length >= 8 &&
        line.length <= 120 &&
        !parsePrices(line, { section: "pricing_card" }).length &&
        !contactPattern.test(line) &&
        !ctaPattern.test(line) &&
        !pricingContextPattern.test(line),
    )
    .slice(0, 8);
}

function planFromText({
  text,
  sourceUrl,
  fallback,
  section,
  cta,
}: {
  text: string;
  sourceUrl: string;
  fallback: string;
  section: string;
  cta: string | null;
}): PricingPlanModel | null {
  const prices = parsePrices(text, { section });
  const hasContact = contactPattern.test(text);

  if (!prices.length && !hasContact) {
    return null;
  }

  const detectedPrice = prices[0];
  const name = hasContact && !prices.length
    ? planNameFromText(text, "Enterprise")
    : planNameFromText(text, fallback);
  const isFreePlan = Boolean(name && /^free$/i.test(name));
  const price = isFreePlan && detectedPrice?.amount !== 0 ? null : detectedPrice;

  if (!name) {
    return null;
  }
  const limit = limitFromText(text);
  const isEnterprise = /enterprise|custom/i.test(`${name} ${text}`);
  const isCustom = hasContact && !prices.length;
  const billingType: PricingPlanModel["billing_type"] =
    isCustom
      ? "custom"
      : limit && /pageviews?|requests?|events?|visits?/i.test(limit)
        ? "usage_based"
        : /\b(?:per|\/)\s?(?:user|seat)\b/i.test(text)
          ? "seat_based"
          : "fixed";

  return {
    id: sentenceCaseKey(`${name}-${price?.raw ?? "custom"}-${limit ?? ""}`),
    name,
    price: isFreePlan ? 0 : price?.amount ?? null,
    currency: price?.currency ?? null,
    billing_period: price?.billing_period ?? "unknown",
    billing_mode: isCustom
      ? "custom"
      : price?.billing_mode ?? (billingType === "usage_based" ? "usage" : "unknown"),
    billing_type: billingType,
    limits: limit ? [limit] : [],
    included_features: includedFeaturesFromText(text),
    cta,
    is_enterprise: isEnterprise,
    is_custom_price: isCustom,
    evidence: [evidence({ sourceUrl, text, section, confidence: price ? "high" : "medium" })],
    confidence: price ? "high" : "medium",
    source: sourceUrl,
  };
}

function usageTierFromText({
  text,
  sourceUrl,
  index,
  section,
}: {
  text: string;
  sourceUrl: string;
  index: number;
  section: string;
}): PricingUsageTierModel | null {
  const price = parsePrices(text, { section })[0] ?? null;
  const limit = limitFromText(text);
  const isContactTier = contactPattern.test(text) && Boolean(limit);

  if (!limit || (!price && !isContactTier)) {
    return null;
  }

  return {
    id: sentenceCaseKey(`${limit}-${price?.raw ?? "contact"}-${index}`),
    label: limit,
    price: price?.amount ?? null,
    currency: price?.currency ?? null,
    billing_period: price?.billing_period ?? "unknown",
    limit,
    unit: unitFromLimit(limit),
    evidence: [evidence({ sourceUrl, text, section, confidence: price ? "high" : "medium" })],
    confidence: price ? "high" : "medium",
    source: sourceUrl,
  };
}

function parseTableStructures($: cheerio.CheerioAPI, sourceUrl: string) {
  const plans: PricingPlanModel[] = [];
  const tiers: PricingUsageTierModel[] = [];

  $("table,[role='table']").each((tableIndex, table) => {
    $(table)
      .find("tr,[role='row']")
      .each((rowIndex, row) => {
        const cells = $(row)
          .find("th,td,[role='cell'],[role='columnheader']")
          .map((_, cell) => normalizeText($(cell).text()))
          .get()
          .filter(Boolean);
        const rowText = cells.length ? cells.join(" ") : normalizeText($(row).text());

        if (!rowText || !pricingContextPattern.test(rowText) && !parsePrices(rowText, { section: "pricing_table" }).length && !contactPattern.test(rowText)) {
          return;
        }

        const tier = usageTierFromText({
          text: rowText,
          sourceUrl,
          index: tableIndex * 100 + rowIndex,
          section: "pricing_table",
        });
        const plan = planFromText({
          text: rowText,
          sourceUrl,
          fallback: cells[0] ?? "Public pricing",
          section: "pricing_table",
          cta: null,
        });

        if (tier) tiers.push(tier);
        if (plan && !tier) plans.push(plan);
      });
  });

  return { plans, tiers };
}

function parseCardStructures($: cheerio.CheerioAPI, sourceUrl: string) {
  const plans: PricingPlanModel[] = [];
  const selector = [
    "article",
    "li",
    "section",
    "form",
    "dialog",
    "[role='dialog']",
    "[class*='modal']",
    "[id*='modal']",
    "[class*='price']",
    "[id*='price']",
    "[class*='pricing']",
    "[id*='pricing']",
    "[class*='plan']",
    "[id*='plan']",
    "[class*='tier']",
    "[id*='tier']",
  ].join(",");

  $(selector).each((index, element) => {
    const text = textForElement($, element);

    if (
      text.length < 8 ||
      text.length > 1800 ||
      (!parsePrices(text, { section: "pricing_card" }).length && !contactPattern.test(text)) ||
      (!pricingContextPattern.test(text) && !planNamePattern.test(text))
    ) {
      return;
    }

    const priceCount = parsePrices(text, { section: "pricing_card" }).length;

    if (priceCount > 4 && !$(element).is("dialog,[role='dialog'],[class*='modal'],[id*='modal']")) {
      return;
    }

    const plan = planFromText({
      text,
      sourceUrl,
      fallback: "Public pricing",
      section: "pricing_card",
      cta: ctaFromElement($, element),
    });

    if (plan) {
      plans.push(plan);
    }
  });

  return uniqueBy(
    plans,
    (plan) =>
      `${sentenceCaseKey(plan.name)}:${plan.price ?? "custom"}:${plan.currency ?? ""}:${plan.limits.join("|")}`,
  );
}

function parseHeadingPlanStructures($: cheerio.CheerioAPI, sourceUrl: string) {
  const plans: PricingPlanModel[] = [];

  $("h2,h3,h4").each((index, heading) => {
    const headingText = normalizeText($(heading).text());

    if (!planNamePattern.test(headingText)) {
      return;
    }

    const container = $(heading)
      .parents("article,li,div,section")
      .toArray()
      .find((candidate) => {
        const text = textForElement($, candidate);
        const html = $.html(candidate);

        return (
          text.length >= 12 &&
          text.length <= 2200 &&
          (parsePrices(text, { section: "pricing_card" }).length ||
            contactPattern.test(text) ||
            /price\(currency,\s*volumeIndex/i.test(html))
        );
      });

    if (!container) {
      return;
    }

    const plan = planFromText({
      text: textForElement($, container),
      sourceUrl,
      fallback: headingText,
      section: "pricing_card",
      cta: ctaFromElement($, container),
    });

    if (plan) {
      plans.push(plan);
    }
  });

  return uniqueBy(
    plans,
    (plan) =>
      `${sentenceCaseKey(plan.name)}:${plan.price ?? "custom"}:${plan.currency ?? ""}:${plan.billing_period}:${plan.limits.join("|")}`,
  );
}

function parseAlpineVolumePlans(html: string, sourceUrl: string) {
  const plans: PricingPlanModel[] = [];
  const tiers: PricingUsageTierModel[] = [];
  const arrayText = html.match(/volumesWithPrices\s*=\s*(\[[\s\S]*?\]);/)?.[1];

  if (!arrayText) {
    return { plans, tiers };
  }

  const currency =
    currencyFor(html.match(/currency:\s*['"]([^'"]+)['"]/)?.[1] ?? "$") ?? "USD";
  const rows = arrayText.match(/\{[^}]+\}/g) ?? [];
  const firstRow = rows[0] ?? "";
  const planKeys = ["starter", "growth", "business"] as const;

  for (const key of planKeys) {
    const amount = Number(firstRow.match(new RegExp(`${key}:\\s*(\\d+)`, "i"))?.[1]);

    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    const volume = firstRow.match(/volume:\s*["']([^"']+)["']/i)?.[1] ?? null;
    const name = key[0].toUpperCase() + key.slice(1);
    const evidenceText = `${name} ${currency === "EUR" ? "\u20AC" : currency === "GBP" ? "\u00A3" : "$"}${amount}/month${volume ? ` up to ${volume} monthly pageviews` : ""}`;

    plans.push({
      id: sentenceCaseKey(`alpine-${key}-${amount}`),
      name,
      price: amount,
      currency,
      billing_period: "month",
      billing_mode: "monthly",
      billing_type: "usage_based",
      limits: volume ? [`Up to ${volume} monthly pageviews`] : [],
      included_features: [],
      cta: null,
      is_enterprise: false,
      is_custom_price: false,
      evidence: [
        evidence({
          sourceUrl,
          text: evidenceText,
          section: "pricing_script",
          confidence: "high",
        }),
      ],
      confidence: "high",
      source: sourceUrl,
    });
  }

  rows.forEach((row, rowIndex) => {
    const volume = row.match(/volume:\s*["']([^"']+)["']/i)?.[1];

    if (!volume) {
      return;
    }

    for (const key of planKeys) {
      const amount = Number(row.match(new RegExp(`${key}:\\s*(\\d+)`, "i"))?.[1]);

      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      const name = key[0].toUpperCase() + key.slice(1);
      const text = `${name} ${currency === "EUR" ? "\u20AC" : currency === "GBP" ? "\u00A3" : "$"}${amount}/month up to ${volume} monthly pageviews`;

      tiers.push({
        id: sentenceCaseKey(`alpine-${key}-${volume}-${amount}-${rowIndex}`),
        label: `${name} up to ${volume} monthly pageviews`,
        price: amount,
        currency,
        billing_period: "month",
        limit: `Up to ${volume} monthly pageviews`,
        unit: "pageviews",
        evidence: [
          evidence({
            sourceUrl,
            text,
            section: "pricing_script",
            confidence: "high",
          }),
        ],
        confidence: "high",
        source: sourceUrl,
      });
    }
  });

  return {
    plans,
    tiers,
  };
}

function parseLineUsageTiers(lines: string[], sourceUrl: string) {
  const windows = lines.map((line, index) =>
    lines.slice(Math.max(0, index - 1), index + 2).join(" "),
  );

  return uniqueBy(
    windows
      .map((text, index) =>
        usageTierFromText({
          text,
          sourceUrl,
          index,
          section: "pricing_usage_tier",
        }),
      )
      .filter((tier): tier is PricingUsageTierModel => Boolean(tier)),
    (tier) => `${tier.limit}:${tier.price ?? "contact"}:${tier.currency ?? ""}`,
  );
}

function parseEnterpriseOptions(
  plans: PricingPlanModel[],
): PricingEnterpriseOption[] {
  return uniqueBy(
    plans
      .filter((plan) => plan.is_enterprise || plan.is_custom_price)
      .map((plan): PricingEnterpriseOption => ({
        name: plan.name || "Enterprise",
        cta: plan.cta,
        is_custom_price: true,
        evidence: plan.evidence,
        confidence: plan.confidence,
        source: plan.source,
      })),
    (option) => sentenceCaseKey(`${option.name}:${option.cta ?? ""}`),
  );
}

function modelType({
  plans,
  usageTiers,
  text,
}: {
  plans: PricingPlanModel[];
  usageTiers: PricingUsageTierModel[];
  text: string;
}): PricingModel["pricing_model_type"] {
  const billingTypes = new Set(plans.map((plan) => plan.billing_type));

  if (usageTiers.length >= 2 && /\b(?:slider|calculator)\b/i.test(text)) {
    return "usage_based_slider";
  }

  if (usageTiers.length >= 2 || billingTypes.has("usage_based")) {
    return "usage_based";
  }

  if (billingTypes.size > 1) {
    return "mixed";
  }

  if (billingTypes.has("seat_based")) {
    return "seat_based";
  }

  if (billingTypes.has("custom") || billingTypes.has("contact_sales")) {
    return plans.some((plan) => plan.price !== null) ? "mixed" : "contact_sales";
  }

  return plans.length ? "fixed_plans" : "unknown";
}

function compatibilityPricingModel(
  type: PricingModel["pricing_model_type"],
): PricingModel["pricing_model"] {
  if (type === "fixed_plans") return "fixed";
  if (type === "usage_based" || type === "usage_based_slider") return "usage_based";
  if (type === "seat_based") return "seat_based";
  if (type === "contact_sales") return "contact_sales";
  if (type === "mixed") return "mixed";

  return "unknown";
}

function completenessScore({
  plans,
  usageTiers,
  billingModes,
  missing,
  hasPricingContent,
  interactionRequired,
}: {
  plans: PricingPlanModel[];
  usageTiers: PricingUsageTierModel[];
  billingModes: PricingModel["billing_modes"];
  missing: string[];
  hasPricingContent: boolean;
  interactionRequired: boolean;
}) {
  if (!hasPricingContent && !plans.length && !usageTiers.length) return 0;
  if (interactionRequired && plans.length + usageTiers.length <= 1) return 40;

  let score = 35;

  if (plans.length >= 3 || usageTiers.length >= 5) score += 35;
  else if (plans.length >= 2 || usageTiers.length >= 2) score += 25;
  else if (plans.length || usageTiers.length) score += 15;

  if (plans.some((plan) => plan.is_custom_price) || plans.some((plan) => plan.is_enterprise)) {
    score += 10;
  }

  if (billingModes.length) score += 10;
  if (usageTiers.length >= 5) score += 10;

  const adjusted = score - missing.length * 5;
  const reliableMainStructure =
    (plans.length >= 3 && plans.some((plan) => plan.is_custom_price)) ||
    usageTiers.length >= 8;

  return Math.max(
    0,
    Math.min(100, reliableMainStructure ? Math.max(80, adjusted) : adjusted),
  );
}

export function parsePricingStructure({
  scrape,
  pageType,
}: {
  scrape: ScrapedPage;
  pageType: PageType;
}): PricingModel {
  const sourceUrl = scrape.finalUrl;
  const html = scrape.html ?? "";
  const $ = cheerio.load(html || "<html><body></body></html>");
  const domText = html ? normalizeText($("body").text()) : "";
  const fallbackText = textLines(scrape).join("\n");
  const fullText = [scrape.title, scrape.metaDescription, domText, fallbackText]
    .filter(Boolean)
    .join("\n");
  const lines = html ? allDomLines($) : textLines(scrape);
  const tableStructures = html
    ? parseTableStructures($, sourceUrl)
    : { plans: [], tiers: [] };
  const scriptStructures = html
    ? parseAlpineVolumePlans(html, sourceUrl)
    : { plans: [], tiers: [] };
  const cardPlans = html ? parseCardStructures($, sourceUrl) : [];
  const headingPlans = html ? parseHeadingPlanStructures($, sourceUrl) : [];
  const blockPlans = analysisBlocks(scrape, ["pricing"])
    .filter((block) => block.type === "pricing")
    .map((block) =>
      planFromText({
        text: blockText(block),
        sourceUrl,
        fallback: "Public pricing",
        section: "pricing_block",
        cta: block.buttons.find((button) => ctaPattern.test(button)) ?? null,
      }),
    )
    .filter((plan): plan is PricingPlanModel => Boolean(plan));
  const usageTiers = uniqueBy(
    [...tableStructures.tiers, ...scriptStructures.tiers, ...parseLineUsageTiers(lines, sourceUrl)],
    (tier) => `${tier.limit}:${tier.price ?? "contact"}:${tier.currency ?? ""}`,
  ).slice(0, 40);
  const rawPlans = uniqueBy(
    [
      ...tableStructures.plans,
      ...cardPlans,
      ...headingPlans,
      ...scriptStructures.plans,
      ...blockPlans,
    ],
    (plan) =>
      `${sentenceCaseKey(plan.name)}:${plan.price ?? "custom"}:${plan.currency ?? ""}:${plan.billing_period}:${plan.limits.join("|")}`,
  );
  const planNeedsReview = rawPlans.length > 6 && tableStructures.plans.length < 6;
  const plans = (planNeedsReview
    ? rawPlans.filter((plan) => plan.confidence === "high").slice(0, 6)
    : rawPlans
  ).slice(0, 30);
  const billingModes = uniqueBy(
    [
      ...billingModesFromText(fullText),
      ...plans.map((plan) => plan.billing_mode).filter(
        (mode): mode is PricingModel["billing_modes"][number] =>
          mode !== "unknown",
      ),
    ],
    (mode) => mode,
  );
  const interactionRequired =
    /\b(?:view (?:our )?pricing plans?|pricing modal|open pricing|calculate|calculator|slider)\b/i.test(
      fullText,
    ) && usageTiers.length < 3 && plans.length < 3;
  const missing = [
    billingModes.includes("yearly") &&
    !plans.some((plan) => plan.billing_mode === "yearly") &&
    !usageTiers.some((tier) => tier.billing_period === "year")
      ? "yearly_prices_hidden_or_js_required"
      : null,
    interactionRequired ? "pricing_interaction_required" : null,
    /\b(?:slider|calculator|pageviews?)\b/i.test(fullText) && usageTiers.length < 3
      ? "usage_slider_current_tier_only_or_hidden"
      : null,
    planNeedsReview ? "pricing_needs_review" : null,
  ].filter((item): item is string => Boolean(item));
  const hasPricingContent =
    pageType === "pricing" ||
    pricingContextPattern.test(fullText) ||
    plans.length > 0 ||
    usageTiers.length > 0;
  const pricing_model_type = modelType({ plans, usageTiers, text: fullText });
  const enterpriseOptions = parseEnterpriseOptions(plans);
  const publicPricing = plans.some((plan) => plan.price !== null) || usageTiers.some((tier) => tier.price !== null);
  const contactSales = enterpriseOptions.length > 0;
  const evidenceItems = uniqueBy(
    [
      ...plans.flatMap((plan) => plan.evidence),
      ...usageTiers.flatMap((tier) => tier.evidence),
      ...enterpriseOptions.flatMap((option) => option.evidence),
    ],
    (item) => `${item.source_url}:${sentenceCaseKey(item.evidence_text)}`,
  ).slice(0, 20);
  const completeness = completenessScore({
    plans,
    usageTiers,
    billingModes,
    missing,
    hasPricingContent,
    interactionRequired,
  });

  return {
    pricing_visibility: publicPricing && contactSales
      ? "partially_public"
      : publicPricing
        ? "public"
        : contactSales
          ? "contact_sales"
          : hasPricingContent
            ? "hidden"
            : "unknown",
    pricing_model: compatibilityPricingModel(pricing_model_type),
    pricing_model_type,
    billing_modes: billingModes,
    plans,
    usage_tiers: usageTiers,
    enterprise_options: enterpriseOptions,
    evidence: evidenceItems,
    confidence:
      completeness >= 80 ? "high" : completeness >= 55 ? "medium" : "low",
    completeness_score: completeness,
    missing_possible_data: missing,
  };
}
