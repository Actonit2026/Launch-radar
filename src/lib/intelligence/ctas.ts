import type { ScrapedPage } from "@/lib/crawler/scraper";
import type { CtaAnalysis, CtaFact, CtaIntent } from "@/lib/intelligence/types";
import {
  makeFact,
  sentenceCaseKey,
  textLines,
  uniqueBy,
} from "@/lib/intelligence/text";

const ctaPatterns: Array<{ intent: CtaIntent; pattern: RegExp; score: number }> =
  [
    { intent: "book_demo", pattern: /\b(?:book|get|schedule|request)\s+(?:a\s+)?demo\b/i, score: 0.9 },
    { intent: "contact_sales", pattern: /\b(?:contact|talk to)\s+sales\b/i, score: 0.88 },
    { intent: "start_trial", pattern: /\b(?:start|try|begin)\s+(?:free|trial)\b/i, score: 0.84 },
    { intent: "sign_up", pattern: /\b(?:sign up|signup|create account|join)\b/i, score: 0.78 },
    { intent: "get_started", pattern: /\bget started\b/i, score: 0.76 },
    { intent: "view_pricing", pattern: /\b(?:view|see|compare)?\s?pricing\b/i, score: 0.72 },
    { intent: "download", pattern: /\bdownload\b/i, score: 0.72 },
  ];

function classifyCta(value: string) {
  const match = ctaPatterns.find((candidate) => candidate.pattern.test(value));

  return match ?? { intent: "unknown" as const, score: 0.4 };
}

function ctaFact({
  text,
  sourceUrl,
  destinationUrl,
  evidenceText,
  order,
}: {
  text: string;
  sourceUrl: string;
  destinationUrl?: string;
  evidenceText: string;
  order: number;
}): CtaFact {
  const classification = classifyCta(text);
  const confidenceScore = Math.max(0.36, classification.score - order * 0.03);

  return makeFact({
    field: order === 0 ? "primary_cta" : "secondary_cta",
    value: text,
    normalizedValue: {
      intent: classification.intent,
      ...(destinationUrl ? { destination_url: destinationUrl } : {}),
    },
    confidence:
      classification.intent === "unknown"
        ? "low"
        : confidenceScore >= 0.8
          ? "high"
          : "medium",
    confidenceScore,
    sourceUrl,
    evidenceText,
    extractionMethod: destinationUrl
      ? "deterministic_link"
      : "deterministic_keyword",
  });
}

export function analyzeCtas(scrape: ScrapedPage): CtaAnalysis {
  const sourceUrl = scrape.finalUrl;
  const linkFacts = scrape.links
    .filter((link) => link.text && classifyCta(link.text).intent !== "unknown")
    .slice(0, 8)
    .map((link, index) =>
      ctaFact({
        text: link.text,
        sourceUrl,
        destinationUrl: link.url,
        evidenceText: link.text,
        order: index,
      }),
    );
  const lineFacts = textLines(scrape)
    .filter((line) => classifyCta(line).intent !== "unknown")
    .slice(0, 4)
    .map((line, index) =>
      ctaFact({
        text: line,
        sourceUrl,
        evidenceText: line,
        order: linkFacts.length + index,
      }),
    );
  const ctas = uniqueBy([...linkFacts, ...lineFacts], (fact) =>
    sentenceCaseKey(`${fact.value}:${fact.normalized_value?.destination_url ?? ""}`),
  ).slice(0, 6);
  const warnings = ctas.length ? [] : ["No clear calls to action detected."];

  return {
    status: ctas.length ? "found" : "unavailable",
    primaryCta: ctas[0] ?? null,
    secondaryCta: ctas[1] ?? null,
    ctas,
    warnings,
  };
}
