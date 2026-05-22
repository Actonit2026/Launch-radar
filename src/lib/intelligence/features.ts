import type { PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type { FeatureAnalysis, FeatureFact } from "@/lib/intelligence/types";
import {
  analysisBlocks,
  blockText,
  makeFact,
  sentenceCaseKey,
  textLines,
  uniqueBy,
} from "@/lib/intelligence/text";

const featureSignalPattern =
  /\b(?:feature|integration|workflow|automation|automated|dashboard|dashboards|analytics|report|summary|summaries|api|security|sso|export|import|collaboration|template|templates|webhook|webhooks|alerts|search|sync|permissions|roles|tracking|monitoring|proposal|proposals|generator|generation|voice|personalization|personalized|writing sample|matching|runbook|runbooks|escalation|escalations|status page|editor)\b/i;
const rejectedFeaturePattern =
  /\b(?:pricing|price|free|contact sales|book a demo|sign up|get started|privacy|terms|cookie|copyright)\b/i;

function featureNameFromLine(line: string) {
  const cleaned = line
    .replace(/\s+(?:learn more|read more|get started|try free)$/i, "")
    .trim();

  if (
    cleaned.length < 4 ||
    cleaned.length > 90 ||
    (rejectedFeaturePattern.test(cleaned) &&
      !featureSignalPattern.test(cleaned))
  ) {
    return null;
  }

  return cleaned;
}

function descriptionForFeature(lines: string[], index: number) {
  const nextLine = lines[index + 1];

  if (
    nextLine &&
    nextLine.length >= 20 &&
    nextLine.length <= 180 &&
    !rejectedFeaturePattern.test(nextLine)
  ) {
    return nextLine;
  }

  return undefined;
}

function featureConfidence(pageType: PageType, line: string) {
  if (pageType === "features" && featureSignalPattern.test(line)) {
    return { confidence: "high" as const, confidenceScore: 0.86 };
  }

  if (featureSignalPattern.test(line)) {
    return { confidence: "medium" as const, confidenceScore: 0.68 };
  }

  return { confidence: "low" as const, confidenceScore: 0.44 };
}

export function analyzeFeatures(
  scrape: ScrapedPage,
  pageType: PageType,
): FeatureAnalysis {
  const lines = textLines(scrape);
  const featureBlockLines = analysisBlocks(scrape, ["features", "hero"])
    .filter((block) => block.type === "features")
    .flatMap((block) => blockText(block).split("\n"));
  const candidateLines = featureBlockLines.length
    ? uniqueBy([...featureBlockLines, ...lines], sentenceCaseKey)
    : lines;
  const sourceUrl = scrape.finalUrl;
  const candidates: FeatureFact[] = [];

  candidateLines.forEach((line, index) => {
    if (!featureSignalPattern.test(line) && pageType !== "features") {
      return;
    }

    const name = featureNameFromLine(line);

    if (!name) {
      return;
    }

    const description = descriptionForFeature(candidateLines, index);
    const confidence = featureConfidence(pageType, line);

    candidates.push(
      makeFact({
        field: "feature",
        value: description ? `${name}: ${description}` : name,
        normalizedValue: {
          name,
          ...(description ? { description } : {}),
        },
        confidence: confidence.confidence,
        confidenceScore: confidence.confidenceScore,
        sourceUrl,
        evidenceText: description ? `${line} ${description}` : line,
        extractionMethod: "deterministic_keyword",
      }),
    );
  });

  const features = uniqueBy(candidates, (feature) =>
    sentenceCaseKey(feature.normalized_value?.name ?? feature.value),
  ).slice(0, 10);
  const reliableFeatures = features.filter(
    (feature) => feature.confidence !== "low",
  );

  if (reliableFeatures.length < 3) {
    return {
      status: "unavailable",
      features: reliableFeatures,
      warnings: ["Not enough feature information detected."],
    };
  }

  return {
    status: "found",
    features: reliableFeatures,
    warnings: [],
  };
}
