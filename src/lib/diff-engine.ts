import type { DetectedChange, PageType } from "@/lib/database.types";
import { formatPageType } from "@/lib/format";

type Severity = DetectedChange["severity"];

export type DiffResult = {
  changed: boolean;
  summary: string;
  severity: Severity;
  additions: string[];
  removals: string[];
  whyItMatters: string;
};

const pricingPattern =
  /(?:[$€£]\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?(?:usd|eur|gbp|\/mo|\/month|\/yr|\/year)|free|annual|yearly|monthly|discount|plan|tier|seat|usage)/i;
const ctaPattern =
  /(?:start|try|book|demo|contact sales|get started|sign up|buy|upgrade|subscribe|join waitlist|request access)/i;
const launchPattern =
  /(?:launch|new|introducing|release|released|shipping|available|beta|update|changelog)/i;
const featurePattern =
  /(?:feature|integration|workflow|automation|dashboard|api|report|analytics|ai|security|sso|export|import)/i;

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function difference(nextLines: string[], previousLines: string[]) {
  const previous = new Set(previousLines);
  return unique(nextLines.filter((line) => !previous.has(line)));
}

function truncate(value: string, maxLength = 130) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function firstMatching(lines: string[], pattern: RegExp) {
  return lines.find((line) => pattern.test(line));
}

function countMatches(lines: string[], pattern: RegExp) {
  return lines.filter((line) => pattern.test(line)).length;
}

function changedHeadline(additions: string[], removals: string[]) {
  const added = additions[0];
  const removed = removals[0];

  if (!added || !removed) {
    return null;
  }

  if (added.length > 20 && removed.length > 20) {
    return { added, removed };
  }

  return null;
}

function severityForChange({
  pageType,
  additions,
  removals,
}: {
  pageType: PageType;
  additions: string[];
  removals: string[];
}): Severity {
  const touchedLines = [...additions, ...removals];
  const pricingSignals = countMatches(touchedLines, pricingPattern);
  const ctaSignals = countMatches(touchedLines, ctaPattern);
  const launchSignals = countMatches(touchedLines, launchPattern);
  const featureSignals = countMatches(touchedLines, featurePattern);
  const changeVolume = additions.length + removals.length;

  if (pageType === "pricing" && pricingSignals > 0) {
    return "high";
  }

  if (pricingSignals >= 2 || changeVolume >= 12) {
    return "high";
  }

  if (
    ctaSignals > 0 ||
    launchSignals > 0 ||
    featureSignals >= 2 ||
    pageType === "changelog"
  ) {
    return "medium";
  }

  return "low";
}

function whyItMatters(pageType: PageType, severity: Severity) {
  if (severity === "high") {
    return "This may affect competitive positioning, sales conversations, or pricing comparisons.";
  }

  if (pageType === "pricing") {
    return "Pricing page movement can change how prospects compare plans.";
  }

  if (pageType === "features") {
    return "Feature movement can signal roadmap or packaging changes.";
  }

  if (pageType === "changelog") {
    return "Release activity can reveal what the competitor is actively shipping.";
  }

  return "Positioning changes can shift how customers understand the product.";
}

function summaryForChange({
  pageType,
  additions,
  removals,
}: {
  pageType: PageType;
  additions: string[];
  removals: string[];
}) {
  const pageLabel = formatPageType(pageType).toLowerCase();
  const addedPricing = firstMatching(additions, pricingPattern);
  const removedPricing = firstMatching(removals, pricingPattern);
  const addedCta = firstMatching(additions, ctaPattern);
  const removedCta = firstMatching(removals, ctaPattern);
  const addedLaunch = firstMatching(additions, launchPattern);
  const addedFeature = firstMatching(additions, featurePattern);
  const headline = changedHeadline(additions, removals);

  if (addedPricing && removedPricing) {
    return `Changed ${pageLabel} pricing language from "${truncate(
      removedPricing,
    )}" to "${truncate(addedPricing)}".`;
  }

  if (addedPricing) {
    return `Added ${pageLabel} pricing language: "${truncate(addedPricing)}".`;
  }

  if (addedCta && removedCta) {
    return `Changed ${pageLabel} CTA from "${truncate(
      removedCta,
    )}" to "${truncate(addedCta)}".`;
  }

  if (addedCta) {
    return `Added ${pageLabel} CTA language: "${truncate(addedCta)}".`;
  }

  if (addedLaunch) {
    return `Added ${pageLabel} launch or release language: "${truncate(
      addedLaunch,
    )}".`;
  }

  if (addedFeature) {
    return `Added ${pageLabel} feature language: "${truncate(addedFeature)}".`;
  }

  if (headline) {
    return `Changed ${pageLabel} positioning from "${truncate(
      headline.removed,
    )}" to "${truncate(headline.added)}".`;
  }

  if (additions.length && removals.length) {
    return `Updated ${pageLabel} copy with ${additions.length} additions and ${removals.length} removals.`;
  }

  if (additions.length) {
    return `Added ${additions.length} new ${pageLabel} text section${
      additions.length === 1 ? "" : "s"
    }.`;
  }

  return `Removed ${removals.length} ${pageLabel} text section${
    removals.length === 1 ? "" : "s"
  }.`;
}

export function detectTextDiff({
  previousText,
  nextText,
  pageType,
}: {
  previousText: string;
  nextText: string;
  pageType: PageType;
}): DiffResult {
  const previousLines = splitLines(previousText);
  const nextLines = splitLines(nextText);
  const additions = difference(nextLines, previousLines);
  const removals = difference(previousLines, nextLines);
  const changed = additions.length > 0 || removals.length > 0;
  const severity = changed
    ? severityForChange({ pageType, additions, removals })
    : "low";

  return {
    changed,
    summary: changed
      ? summaryForChange({ pageType, additions, removals })
      : `No meaningful ${formatPageType(pageType).toLowerCase()} changes detected.`,
    severity,
    additions: additions.slice(0, 8),
    removals: removals.slice(0, 8),
    whyItMatters: whyItMatters(pageType, severity),
  };
}
