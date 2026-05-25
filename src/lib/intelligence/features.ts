import type { PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type { PageBlockType } from "@/lib/crawler/text";
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
  /\b(?:feature|integration|workflow|automation|automated|dashboard|dashboards|analytics|report|summary|summaries|api|security|sso|export|import|collaboration|template|templates|webhook|webhooks|alerts|search|sync|permissions|roles|tracking|monitoring|proposal|proposals|generator|generation|voice|personalization|personalized|writing sample|matching|runbook|runbooks|escalation|escalations|status page|editor|session replay|replay|funnels?|heatmaps?|cohorts?|segmentation|experimentation|a\/b testing|feature flags?|feature management|autocapture|events?|data warehouse|web analytics|product analytics|revenue analytics|survey|surveys|traces?|evals?|graphs?|lifecycle|user paths?|activation|visual editing|edit visually|design|database|logic|privacy rules?|no-code app builder|build with ai)\b/i;
const rejectedFeaturePattern =
  /\b(?:pricing|price|free|contact sales|book a demo|sign up|get started|start free|start trial|privacy|terms|cookie|copyright|learn more|live demo|view demo|copy to clipboard|testimonial|customer story|case study|co-founder|founder|ceo|cto|people love|trusted by|customer logos?|logo cloud|rated|stars?|g2|capterra|award|press)\b/i;
const softRejectedFeaturePattern =
  /\b(?:review|rated|stars|former .* lead|people .{0,4} love|ready to|join us|why you should|it'?s time to)\b/i;
const featureSectionPattern =
  /\b(?:features?|capabilities|platform|product|benefits?|included|compare|comparison|feature grid|what you can do|everything you need|built for)\b/i;
const capabilityTermPattern =
  /\b(?:build with ai|edit visually|visual editing|design|database|logic|privacy rules?|no-code app builder)\b/gi;

type FeatureCandidateSource = {
  line: string;
  lines: string[];
  index: number;
  blockType: PageBlockType | "visible_text";
  structured: boolean;
};

function featureNameFromLine(line: string) {
  const cleaned = line
    .replace(/\s+(?:learn more|read more|get started|try free)$/i, "")
    .replace(/^(.{4,80})\s*:\s*\1$/i, "$1")
    .trim();

  if (
    cleaned.length < 4 ||
    cleaned.length > 90 ||
    /^\d{4}(?:-\d{4})?$/.test(cleaned) ||
    /^(?:import|const|function|npm|curl)\b/i.test(cleaned) ||
    softRejectedFeaturePattern.test(cleaned) ||
    (rejectedFeaturePattern.test(cleaned) && !featureSignalPattern.test(cleaned))
  ) {
    return null;
  }

  return cleaned;
}

function descriptionForFeature(lines: string[], index: number) {
  const currentLine = lines[index];
  const nextLine = lines[index + 1];

  if (
    nextLine &&
    nextLine.length >= 20 &&
    nextLine.length <= 180 &&
    !rejectedFeaturePattern.test(nextLine) &&
    sentenceCaseKey(nextLine) !== sentenceCaseKey(currentLine) &&
    !sentenceCaseKey(nextLine).startsWith(`${sentenceCaseKey(currentLine)} `)
  ) {
    return nextLine;
  }

  return undefined;
}

function featureValue({
  name,
  description,
}: {
  name: string;
  description?: string;
}) {
  if (!description || sentenceCaseKey(description) === sentenceCaseKey(name)) {
    return name;
  }

  return `${name}: ${description}`;
}

function featureConfidence({
  pageType,
  line,
  blockType,
  structured,
}: {
  pageType: PageType;
  line: string;
  blockType: PageBlockType | "visible_text";
  structured: boolean;
}) {
  if (
    featureSignalPattern.test(line) &&
    (pageType === "features" || blockType === "features")
  ) {
    return { confidence: "high" as const, confidenceScore: 0.86 };
  }

  if (
    structured &&
    (blockType === "features" || blockType === "comparison") &&
    (featureSignalPattern.test(line) || featureSectionPattern.test(line))
  ) {
    return { confidence: "medium" as const, confidenceScore: 0.72 };
  }

  if (featureSignalPattern.test(line)) {
    return { confidence: "medium" as const, confidenceScore: 0.68 };
  }

  return { confidence: "low" as const, confidenceScore: 0.44 };
}

function candidateSources(
  scrape: ScrapedPage,
  pageType: PageType,
): FeatureCandidateSource[] {
  const lines = textLines(scrape);
  const sources: FeatureCandidateSource[] = [];

  analysisBlocks(scrape, ["features", "comparison", "hero"]).forEach((block) => {
    const usefulBlock =
      block.type === "features" ||
      block.type === "comparison" ||
      (pageType === "features" && block.type === "hero") ||
      (block.heading ? featureSectionPattern.test(block.heading) : false);

    if (!usefulBlock) {
      return;
    }

    const blockLines = blockText(block)
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    blockLines.forEach((line, index) => {
      sources.push({
        line,
        lines: blockLines,
        index,
        blockType: block.type,
        structured: true,
      });
    });
  });

  lines.forEach((line, index) => {
    sources.push({
      line,
      lines,
      index,
      blockType: "visible_text",
      structured: false,
    });
  });

  return uniqueBy(sources, (source) =>
    `${source.blockType}:${sentenceCaseKey(source.line)}`,
  );
}

function capabilityFeaturesFromLine(line: string) {
  if (!/\b(?:build|builder|app|apps|product|platform)\b/i.test(line)) {
    return [];
  }

  const matches = line.match(capabilityTermPattern) ?? [];
  const normalized = uniqueBy(
    matches.map((match) => {
      const value = match.toLowerCase();

      if (value === "edit visually") {
        return "Visual editing";
      }

      if (value === "privacy rule" || value === "privacy rules") {
        return "Privacy rules";
      }

      if (value === "build with ai") {
        return "Build with AI";
      }

      if (value === "no-code app builder") {
        return "No-code app builder";
      }

      return value.charAt(0).toUpperCase() + value.slice(1);
    }),
    sentenceCaseKey,
  );

  return normalized.length >= 3 ? normalized : [];
}

export function analyzeFeatures(
  scrape: ScrapedPage,
  pageType: PageType,
): FeatureAnalysis {
  const sourceUrl = scrape.finalUrl;
  const candidates: FeatureFact[] = [];

  candidateSources(scrape, pageType).forEach((source) => {
    const { line, lines, index, blockType, structured } = source;
    const inFeatureContext =
      structured &&
      (blockType === "features" ||
        blockType === "comparison" ||
        lines.some((candidate) => featureSectionPattern.test(candidate)));

    if (!featureSignalPattern.test(line) && pageType !== "features" && !inFeatureContext) {
      return;
    }

    capabilityFeaturesFromLine(line).forEach((capability) => {
      candidates.push(
        makeFact({
          field: "feature",
          value: capability,
          normalizedValue: {
            name: capability,
          },
          confidence: "medium",
          confidenceScore: 0.7,
          sourceUrl,
          evidenceText: line,
          extractionMethod: "deterministic_keyword",
        }),
      );
    });

    const name = featureNameFromLine(line);

    if (!name) {
      return;
    }

    const description = descriptionForFeature(lines, index);
    const confidence = featureConfidence({
      pageType,
      line,
      blockType,
      structured,
    });

    candidates.push(
      makeFact({
        field: "feature",
        value: featureValue({ name, description }),
        normalizedValue: {
          name,
          ...(description ? { description } : {}),
        },
        confidence: confidence.confidence,
        confidenceScore: confidence.confidenceScore,
        sourceUrl,
        evidenceText: description ? `${line} ${description}` : line,
        extractionMethod: structured
          ? "deterministic_structure"
          : "deterministic_keyword",
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
