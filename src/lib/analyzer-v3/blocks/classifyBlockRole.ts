import type { AnalyzerV3PageType, BlockRole, EvidenceBlock } from "@/lib/analyzer-v3/types";

const pricingPositive =
  /\b(?:pricing|price|prices|plans?|packages?|tiers?|billing|monthly|yearly|annually|subscription|upgrade|subscribe|checkout|starter|plus|pro|business|enterprise|free plan)\b|[$\u20ac\u00a3]\s?\d|\d\s?[$\u20ac\u00a3]|\u00e2\u201a\u00ac\s?\d|\b(?:usd|eur|gbp)\b/i;
const featurePositive =
  /\b(?:features?|capabilities|platform|workflow|automation|integrations?|dashboard|analytics|alerts|templates|collaboration|api|security|reports?|proposal|generator|personalized|client-ready|writing sample)\b/i;
const ctaPositive =
  /\b(?:start free|start trial|get started|sign up|signup|book demo|schedule demo|contact sales|talk to sales|try free|download|upgrade|buy now|get plus|get pro)\b/i;
const changelogPositive =
  /\b(?:changelog|updates?|release notes?|releases?|shipped|fixed|improved|new in|version|v\d+(?:\.\d+)*)\b/i;

const negativeSignals: Array<{ role: BlockRole; pattern: RegExp; signal: string }> = [
  { role: "navigation", pattern: /\b(?:nav|navbar|navigation|menu)\b/i, signal: "navigation" },
  { role: "footer", pattern: /\b(?:footer|contentinfo|copyright|all rights reserved)\b/i, signal: "footer" },
  { role: "legal", pattern: /\b(?:privacy policy|terms of service|cookie policy|legal)\b/i, signal: "legal" },
  { role: "cookie_banner", pattern: /\b(?:cookies?|consent|accept all|reject all)\b/i, signal: "cookie" },
  { role: "testimonial", pattern: /\b(?:testimonial|review|rated|stars|what customers say)\b/i, signal: "testimonial" },
  { role: "case_study", pattern: /\b(?:case study|customer story|client story)\b/i, signal: "case_study" },
  { role: "proposal_sample", pattern: /\b(?:proposal sample|sample proposal|generated proposal|example proposal)\b/i, signal: "proposal_sample" },
  { role: "example_output", pattern: /\b(?:example output|sample output|generated output|example result)\b/i, signal: "example_output" },
  { role: "job_example", pattern: /\b(?:upwork|freelancer|hiring|project budget|per article|hourly|\/hr)\b/i, signal: "job_example" },
  { role: "blog_content", pattern: /\b(?:blog|read more|published|author)\b/i, signal: "blog" },
];

export function classifyBlockRole({
  text,
  tagName,
  attrText,
  pageType,
  positionIndex,
  tableRows,
  tableColumns,
}: {
  text: string;
  tagName: string;
  attrText: string;
  pageType: AnalyzerV3PageType;
  positionIndex: number;
  tableRows: number;
  tableColumns: number;
}): {
  role: BlockRole;
  confidence: number;
  positiveSignals: string[];
  negativeSignals: string[];
} {
  const combined = `${attrText}\n${text}`;
  const positives: string[] = [];
  const negatives: string[] = [];

  for (const negative of negativeSignals) {
    if (negative.pattern.test(combined)) {
      negatives.push(negative.signal);

      if (
        !pricingPositive.test(combined) ||
        ["proposal_sample", "job_example", "case_study", "testimonial", "example_output"].includes(negative.signal)
      ) {
        return {
          role: negative.role,
          confidence: 0.9,
          positiveSignals: positives,
          negativeSignals: negatives,
        };
      }
    }
  }

  if (tagName === "nav") {
    return { role: "navigation", confidence: 0.95, positiveSignals: positives, negativeSignals: negatives };
  }

  if (tagName === "footer") {
    return { role: "footer", confidence: 0.95, positiveSignals: positives, negativeSignals: negatives };
  }

  if (tableRows >= 2 && tableColumns >= 2 && pricingPositive.test(combined)) {
    positives.push("pricing_table");
    return { role: "pricing_table", confidence: 0.93, positiveSignals: positives, negativeSignals: negatives };
  }

  if (pricingPositive.test(combined)) {
    positives.push("pricing");

    if (/\b(?:toggle|monthly|yearly|annually)\b/i.test(combined)) {
      positives.push("billing_toggle");
    }

    if (/\b(?:card|plan|tier|starter|plus|pro|business|enterprise|free)\b/i.test(combined) || pageType === "pricing") {
      return {
        role: /\b(?:compare|comparison)\b/i.test(combined) ? "plan_comparison" : "pricing_card",
        confidence: pageType === "pricing" ? 0.92 : 0.84,
        positiveSignals: positives,
        negativeSignals: negatives,
      };
    }

    return { role: "pricing_section", confidence: 0.8, positiveSignals: positives, negativeSignals: negatives };
  }

  if (changelogPositive.test(combined)) {
    positives.push("changelog");
    return {
      role: /\b(?:release notes?|version|v\d+(?:\.\d+)*)\b/i.test(combined)
        ? "release_note"
        : "changelog_entry",
      confidence: pageType === "changelog" ? 0.9 : 0.76,
      positiveSignals: positives,
      negativeSignals: negatives,
    };
  }

  if (featurePositive.test(combined)) {
    positives.push("feature");
    return {
      role: /\b(?:integration|connect|api)\b/i.test(combined) ? "integration_section" : "feature_card",
      confidence: pageType === "features" ? 0.86 : 0.74,
      positiveSignals: positives,
      negativeSignals: negatives,
    };
  }

  if (ctaPositive.test(combined)) {
    positives.push("cta");
    return { role: "cta_section", confidence: positionIndex <= 3 ? 0.82 : 0.68, positiveSignals: positives, negativeSignals: negatives };
  }

  if (/^(?:header|main)$/i.test(tagName) || /\bhero|masthead\b/i.test(attrText) || positionIndex <= 1) {
    positives.push("hero_position");
    return { role: "hero", confidence: 0.72, positiveSignals: positives, negativeSignals: negatives };
  }

  if (/\b(?:faq|frequently asked)\b/i.test(combined)) {
    return { role: "faq", confidence: 0.72, positiveSignals: positives, negativeSignals: negatives };
  }

  return { role: "unknown", confidence: 0.42, positiveSignals: positives, negativeSignals: negatives };
}

export function blockRoleCounts(blocks: EvidenceBlock[]) {
  return blocks.reduce<Record<string, number>>((counts, block) => {
    counts[block.role] = (counts[block.role] ?? 0) + 1;
    return counts;
  }, {});
}
