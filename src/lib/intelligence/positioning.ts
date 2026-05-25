import type { PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type {
  PositioningAnalysis,
  StructuredFact,
} from "@/lib/intelligence/types";
import {
  analysisBlocks,
  blockText,
  isGenericBusinessSummary,
  makeFact,
  sentenceCaseKey,
  textLines,
  uniqueBy,
} from "@/lib/intelligence/text";

const productCategoryPattern =
  /\b(?:platform|software|tool|app|generator|proposal|crm|analytics|billing|automation|workspace|assistant|copilot|api|infrastructure|intelligence|monitoring|database|search|support|helpdesk)\b/i;
const valuePropPattern =
  /\b(?:helps?|automate|track|monitor|manage|build|launch|ship|analyze|convert|reduce|increase|without|faster|in minutes|in days|so you can)\b/i;
const targetCustomerPatterns = [
  /\b(?:built|made|designed|created)\s+for\s+([^.]{3,80})/i,
  /\bfor\s+((?:[A-Z][A-Za-z0-9& -]{2,60}|[a-z][a-z0-9& -]{2,60}(?:teams|founders|startups|companies|agencies|developers|marketers|sales teams)))/,
];
const useCasePattern =
  /\b(?:use case|workflow|for teams that|to help|so you can|without)\b/i;
const positioningNoisePattern =
  /\b(?:example|sample|template|generated proposal|proposal sample|job post|project budget|article budget|per article|per hour|\/hr|salary|budget|freelance job|client project)\b|[$\u20AC\u00A3]\s?\d|\d\s?[$\u20AC\u00A3]|\b(?:usd|eur|gbp)\s?\d/i;

function usableLine(line: string) {
  return (
    line.length >= 8 &&
    line.length <= 180 &&
    !isGenericBusinessSummary(line) &&
    !positioningNoisePattern.test(line) &&
    !/^(?:pricing|features|docs|login|log in|sign in|sign up|dashboard|copy to clipboard|learn more|view demo|live demo)$/i.test(line) &&
    !/\b(?:login to your dashboard|forgot password|reset password|copy to clipboard|npm install|import \{|const\s|function\s*\(|curl\s)/i.test(line)
  );
}

function cleanPositioningLine(line: string) {
  return line
    .replace(/\s+(?:login|log in|sign in)\s+(?:to your dashboard|dashboard|account).*$/i, "")
    .replace(/\s+(?:pricing|features|docs)\s+(?:login|log in|sign in).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstUsefulLine(lines: string[], exclude = new Set<string>()) {
  return lines.find(
    (line) => usableLine(line) && !exclude.has(sentenceCaseKey(line)),
  );
}

function targetFromLine(line: string) {
  for (const pattern of targetCustomerPatterns) {
    const target = pattern.exec(line)?.[1]?.trim();

    if (target && target.length <= 80) {
      return target.replace(/\s+(?:with|by|to|that)\b.*$/i, "").trim();
    }
  }

  return null;
}

function fact({
  field,
  value,
  sourceUrl,
  evidenceText,
  confidenceScore,
}: {
  field: string;
  value: string;
  sourceUrl: string;
  evidenceText: string;
  confidenceScore: number;
}) {
  return makeFact({
    field,
    value,
    confidence:
      confidenceScore >= 0.8
        ? "high"
        : confidenceScore >= 0.58
          ? "medium"
          : "low",
    confidenceScore,
    sourceUrl,
    evidenceText,
    extractionMethod: "deterministic_keyword",
  });
}

export function analyzePositioning(
  scrape: ScrapedPage,
  pageType: PageType,
): PositioningAnalysis {
  const sourceUrl = scrape.finalUrl;
  const bodyLines = textLines(scrape);
  const hasPageModel = Boolean(scrape.pageModel?.blocks.length);
  const heroBlocks = analysisBlocks(scrape, ["hero"]).filter(
    (block) => block.type === "hero",
  );
  const heroLines = uniqueBy(
    [
      ...(scrape.pageModel?.h1 ? [scrape.pageModel.h1] : []),
      ...heroBlocks.flatMap((block) => [
        block.heading ?? "",
        ...blockText(block).split("\n"),
      ]),
    ]
      .map(cleanPositioningLine)
      .filter(Boolean),
    sentenceCaseKey,
  );
  const metaLines = [
    scrape.metaDescription,
    scrape.pageModel?.ogDescription,
    scrape.pageModel?.ogTitle,
    scrape.title,
  ].filter((line): line is string => Boolean(line));
  const lines = uniqueBy(
    (hasPageModel
      ? [...heroLines, ...metaLines, ...bodyLines]
      : [...bodyLines, ...metaLines])
      .map(cleanPositioningLine)
      .filter(Boolean),
    sentenceCaseKey,
  );
  const homepageLines = uniqueBy(
    (hasPageModel
      ? [...heroLines, ...metaLines, ...bodyLines]
      : [...bodyLines, ...metaLines])
      .map(cleanPositioningLine)
      .filter(Boolean),
    sentenceCaseKey,
  );
  const used = new Set<string>();
  const facts: StructuredFact[] = [];
  const homepageHeadline =
    pageType === "homepage"
      ? firstUsefulLine(homepageLines)
      : firstUsefulLine(metaLines);

  if (homepageHeadline) {
    used.add(sentenceCaseKey(homepageHeadline));
    facts.push(
      fact({
        field: "homepage_headline",
        value: homepageHeadline,
        sourceUrl,
        evidenceText: homepageHeadline,
        confidenceScore: pageType === "homepage" ? 0.86 : 0.62,
      }),
    );
  }

  const subheadline = firstUsefulLine(lines, used);

  if (subheadline) {
    used.add(sentenceCaseKey(subheadline));
    facts.push(
      fact({
        field: "subheadline",
        value: subheadline,
        sourceUrl,
        evidenceText: subheadline,
        confidenceScore: 0.66,
      }),
    );
  }

  const categoryLine = lines.find(
    (line) => usableLine(line) && productCategoryPattern.test(line),
  );

  if (categoryLine) {
    facts.push(
      fact({
        field: "product_category",
        value: categoryLine,
        sourceUrl,
        evidenceText: categoryLine,
        confidenceScore: 0.58,
      }),
    );
  }

  const targetLine = lines.find((line) => targetFromLine(line));
  const targetCustomer = targetLine ? targetFromLine(targetLine) : null;

  if (targetLine && targetCustomer) {
    facts.push(
      fact({
        field: "target_customer",
        value: targetCustomer,
        sourceUrl,
        evidenceText: targetLine,
        confidenceScore: 0.7,
      }),
    );
  }

  const valueLine = lines.find(
    (line) => usableLine(line) && valuePropPattern.test(line),
  );

  if (valueLine) {
    facts.push(
      fact({
        field: "main_value_prop",
        value: valueLine,
        sourceUrl,
        evidenceText: valueLine,
        confidenceScore: 0.68,
      }),
    );
  }

  const useCaseLine = lines.find(
    (line) => usableLine(line) && useCasePattern.test(line),
  );

  if (useCaseLine) {
    facts.push(
      fact({
        field: "key_use_case",
        value: useCaseLine,
        sourceUrl,
        evidenceText: useCaseLine,
        confidenceScore: 0.62,
      }),
    );
  }

  const factsByField = new Map(facts.map((item) => [item.field, item]));
  const warnings = facts.length
    ? []
    : ["Positioning unclear from public page content."];

  return {
    status: facts.length ? "found" : "unclear",
    homepageHeadline: factsByField.get("homepage_headline") ?? null,
    subheadline: factsByField.get("subheadline") ?? null,
    productCategory: factsByField.get("product_category") ?? null,
    targetCustomer: factsByField.get("target_customer") ?? null,
    mainValueProp: factsByField.get("main_value_prop") ?? null,
    keyUseCase: factsByField.get("key_use_case") ?? null,
    facts: uniqueBy(facts, (item) => `${item.field}:${sentenceCaseKey(item.value)}`),
    warnings,
  };
}
