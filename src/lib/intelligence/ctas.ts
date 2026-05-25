import type { PageBlockType } from "@/lib/crawler/text";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type { CtaAnalysis, CtaFact, CtaIntent } from "@/lib/intelligence/types";
import {
  analysisBlocks,
  blockText,
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
    { intent: "upgrade_buy", pattern: /\b(?:upgrade|buy|subscribe|get plus|get pro|choose plan|try now)\b/i, score: 0.82 },
    { intent: "sign_up", pattern: /\b(?:sign up|signup|create account|join)\b/i, score: 0.78 },
    { intent: "get_started", pattern: /\bget started\b/i, score: 0.76 },
    { intent: "view_pricing", pattern: /\b(?:view|see|compare)?\s?pricing\b/i, score: 0.72 },
    { intent: "download", pattern: /\bdownload\b/i, score: 0.72 },
  ];
const ignoredCtaPattern =
  /^(?:login|log in|sign in|dashboard|account|privacy|terms|legal|cookie settings?|copy to clipboard|learn more|docs?|documentation|help|support|status)$/i;
const weakUtilityCtaPattern =
  /\b(?:login|log in|sign in|dashboard|account|privacy|terms|legal|cookies?|docs?|documentation|help center|support|status page)\b/i;
const ctaPhrasePattern =
  /\b(?:book a demo|schedule demo|request demo|get a demo|contact sales|talk to sales|start free|start trial|try free|begin free|sign up|signup|create account|get started|view pricing|see pricing|compare pricing|download|get plus|get pro|choose plan|try now)\b/i;

type CtaCandidate = {
  text: string;
  sourceUrl: string;
  destinationUrl?: string;
  evidenceText: string;
  priority: number;
  sourceBoost: number;
  sequence: number;
  blockType?: PageBlockType;
};

function isLikelyCtaText(value: string) {
  const text = value.trim();

  return (
    text.length >= 2 &&
    text.length <= 48 &&
    !ignoredCtaPattern.test(text) &&
    !/[.:;]/.test(text) &&
    !/\b(?:using|mailchimp|api|sdk|template|analytics|feature|blog|privacy|terms)\b/i.test(
      text,
    )
  );
}

function classifyCta(value: string) {
  if (!isLikelyCtaText(value)) {
    return { intent: "unknown" as const, score: 0.2 };
  }

  const match = ctaPatterns.find((candidate) => candidate.pattern.test(value));

  return match ?? { intent: "unknown" as const, score: 0.4 };
}

function ctaTextsFromLine(line: string) {
  const trimmed = line.trim();

  if (isLikelyCtaText(trimmed)) {
    return [trimmed];
  }

  const phrase = trimmed.match(ctaPhrasePattern)?.[0];

  return phrase ? [phrase] : [];
}

function ctaFact({
  candidate,
  order,
}: {
  candidate: CtaCandidate;
  order: number;
}): CtaFact {
  const classification = classifyCta(candidate.text);
  const confidenceScore = Math.min(
    0.96,
    Math.max(0.36, classification.score + candidate.sourceBoost - order * 0.02),
  );

  return makeFact({
    field: order === 0 ? "primary_cta" : "secondary_cta",
    value: candidate.text,
    normalizedValue: {
      intent: classification.intent,
      ...(candidate.destinationUrl
        ? { destination_url: candidate.destinationUrl }
        : {}),
    },
    confidence:
      classification.intent === "unknown"
        ? "low"
        : confidenceScore >= 0.8
          ? "high"
          : "medium",
    confidenceScore,
    sourceUrl: candidate.sourceUrl,
    evidenceText: candidate.evidenceText,
    extractionMethod: candidate.destinationUrl
      ? "deterministic_link"
      : "deterministic_keyword",
  });
}

function priorityForSource({
  blockType,
  kind,
  fallback,
}: {
  blockType?: PageBlockType;
  kind: "button" | "link" | "line";
  fallback?: boolean;
}) {
  if (fallback) {
    return 20;
  }

  if (blockType === "hero") {
    return kind === "button" ? 100 : 92;
  }

  if (blockType === "cta") {
    return kind === "button" ? 88 : 80;
  }

  if (blockType === "pricing") {
    return kind === "button" ? 82 : 74;
  }

  return kind === "line" ? 42 : 54;
}

function sourceBoostForPriority(priority: number) {
  if (priority >= 100) {
    return 0.08;
  }

  if (priority >= 88) {
    return 0.06;
  }

  if (priority >= 74) {
    return 0.04;
  }

  if (priority <= 20) {
    return -0.05;
  }

  return 0;
}

function usableProductCta(candidate: CtaCandidate) {
  const classification = classifyCta(candidate.text);

  if (classification.intent === "unknown") {
    return false;
  }

  return !weakUtilityCtaPattern.test(candidate.text);
}

function sortedCandidates(candidates: CtaCandidate[]) {
  return uniqueBy(candidates, (candidate) =>
    sentenceCaseKey(
      `${candidate.text}:${candidate.destinationUrl ?? ""}:${candidate.blockType ?? ""}`,
    ),
  ).sort((a, b) => {
    const aClass = classifyCta(a.text);
    const bClass = classifyCta(b.text);

    return (
      b.priority - a.priority ||
      bClass.score - aClass.score ||
      a.sequence - b.sequence
    );
  });
}

export function analyzeCtas(scrape: ScrapedPage): CtaAnalysis {
  const sourceUrl = scrape.finalUrl;
  const blocks = analysisBlocks(scrape, ["hero", "cta", "pricing"]);
  const candidates: CtaCandidate[] = [];
  let sequence = 0;

  blocks.forEach((block) => {
    const evidence = blockText(block);

    block.buttons.forEach((button) => {
      const priority = priorityForSource({
        blockType: block.type,
        kind: "button",
      });

      candidates.push({
        text: button,
        sourceUrl,
        evidenceText: evidence,
        priority,
        sourceBoost: sourceBoostForPriority(priority),
        sequence: sequence++,
        blockType: block.type,
      });
    });

    block.links.forEach((link) => {
      const priority = priorityForSource({
        blockType: block.type,
        kind: "link",
      });

      candidates.push({
        text: link.text,
        sourceUrl,
        destinationUrl: link.url,
        evidenceText: link.text || evidence,
        priority,
        sourceBoost: sourceBoostForPriority(priority),
        sequence: sequence++,
        blockType: block.type,
      });
    });
  });

  textLines(scrape).forEach((line) => {
    const priority = priorityForSource({ kind: "line" });

    ctaTextsFromLine(line).forEach((text) => {
      candidates.push({
        text,
        sourceUrl,
        evidenceText: line,
        priority,
        sourceBoost: sourceBoostForPriority(priority),
        sequence: sequence++,
      });
    });
  });

  if (!candidates.some(usableProductCta)) {
    scrape.links.forEach((link) => {
      const priority = priorityForSource({ kind: "link", fallback: true });

      candidates.push({
        text: link.text,
        sourceUrl,
        destinationUrl: link.url,
        evidenceText: link.text,
        priority,
        sourceBoost: sourceBoostForPriority(priority),
        sequence: sequence++,
      });
    });
  }

  const ctas = sortedCandidates(candidates)
    .filter(usableProductCta)
    .slice(0, 6)
    .map((candidate, index) => ctaFact({ candidate, order: index }));
  const warnings = ctas.length ? [] : ["No clear calls to action detected."];

  return {
    status: ctas.length ? "found" : "unavailable",
    primaryCta: ctas[0] ?? null,
    secondaryCta: ctas[1] ?? null,
    ctas,
    warnings,
  };
}
