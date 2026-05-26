import type { AnalyzerEntity, EvidenceBlock } from "@/lib/analyzer-v3/types";

const limitPattern =
  /\b(?:up to|over|from)?\s*[\d,.]+\s?(?:k|m|million|thousand)?\+?\s+(?:weekly\s+|monthly\s+)?(?:proposals?|pageviews?|users?|seats?|requests?|events?|visits?|sites?)\b|\bunlimited\s+(?:sites?|users?|seats?|events?|pageviews?|proposals?)\b|\bone\s+site\b/gi;

function limitType(value: string): AnalyzerEntity<string>["type"] {
  if (/\bpageviews?|visits?\b/i.test(value)) return "pageview_limit";
  if (/\busers?|seats?\b/i.test(value)) return "seat_limit";
  return "usage_limit";
}

export function extractLimits(blocks: EvidenceBlock[]) {
  const entities: AnalyzerEntity<string>[] = [];

  blocks
    .filter((block) => ["pricing_card", "pricing_table", "plan_comparison", "feature_card"].includes(block.role))
    .forEach((block) => {
      for (const match of block.text.matchAll(limitPattern)) {
        const value = match[0].replace(/\s+/g, " ").trim();

        entities.push({
          id: `${block.id}:limit:${entities.length}`,
          type: limitType(value),
          value,
          normalized_value: value.toLowerCase(),
          source_block_id: block.id,
          source_url: block.final_url,
          evidence_text: block.text.slice(0, 260),
          context_role: block.role,
          confidence: "medium",
          confidence_score: 0.74,
          accepted: true,
          rejection_reason: null,
        });
      }
    });

  return entities;
}
