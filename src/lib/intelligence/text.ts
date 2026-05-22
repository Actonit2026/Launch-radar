import type { ScrapedPage } from "@/lib/crawler/scraper";
import type { PageBlock, PageBlockType } from "@/lib/crawler/text";
import type {
  Confidence,
  FactExtractionMethod,
  StructuredFact,
} from "@/lib/intelligence/types";

export function textLines(scrape: ScrapedPage) {
  if (scrape.pageModel?.visibleContent) {
    return scrape.pageModel.visibleContent
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  return scrape.rawText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export type AnalysisBlock = PageBlock & {
  source: "model" | "fallback";
};

export function analysisBlocks(
  scrape: ScrapedPage,
  preferredTypes: PageBlockType[] = [],
): AnalysisBlock[] {
  const modelBlocks = scrape.pageModel?.blocks
    .filter((block) => !["nav", "footer", "auth"].includes(block.type))
    .map((block) => ({ ...block, source: "model" as const }));

  if (modelBlocks?.length) {
    const preferred = modelBlocks.filter((block) =>
      preferredTypes.includes(block.type),
    );
    const other = modelBlocks.filter(
      (block) => !preferredTypes.includes(block.type),
    );

    return [...preferred, ...other];
  }

  return [
    {
      type: "unknown",
      heading: scrape.title || null,
      text: scrape.rawText,
      buttons: scrape.links.map((link) => link.text).filter(Boolean),
      links: scrape.links,
      confidence: 0.4,
      index: 0,
      source: "fallback",
    },
  ];
}

export function blockText(block: Pick<PageBlock, "heading" | "text" | "buttons" | "links">) {
  return [
    block.heading ?? "",
    block.text,
    ...block.buttons,
    ...block.links.map((link) => link.text),
  ]
    .filter(Boolean)
    .join("\n");
}

export function uniqueBy<T>(
  values: T[],
  keyForValue: (value: T) => string,
) {
  const seen = new Set<string>();
  const uniqueValues: T[] = [];

  for (const value of values) {
    const key = keyForValue(value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

export function sentenceCaseKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9$€£]+/g, " ").trim();
}

export function truncateEvidence(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

export function makeFact<TNormalized>({
  field,
  value,
  normalizedValue,
  confidence,
  confidenceScore,
  sourceUrl,
  evidenceText,
  extractionMethod,
}: {
  field: string;
  value: string;
  normalizedValue?: TNormalized;
  confidence: Confidence;
  confidenceScore: number;
  sourceUrl: string;
  evidenceText: string;
  extractionMethod: FactExtractionMethod;
}): StructuredFact<TNormalized> {
  return {
    field,
    value,
    ...(normalizedValue === undefined
      ? {}
      : { normalized_value: normalizedValue }),
    confidence,
    confidence_score: confidenceScore,
    source_url: sourceUrl,
    evidence_text: truncateEvidence(evidenceText),
    extraction_method: extractionMethod,
  };
}

export function pageTextForSignals(scrape: ScrapedPage) {
  return [scrape.title, scrape.metaDescription, scrape.rawText]
    .filter(Boolean)
    .join("\n");
}

export function isGenericBusinessSummary(value: string) {
  return /^(?:this is a saas product|they offer software solutions|software solutions|businesses improve productivity)$/i.test(
    value.trim(),
  );
}
