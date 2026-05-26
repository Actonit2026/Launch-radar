import type { AnalyzerEntity, EvidenceBlock } from "@/lib/analyzer-v3/types";

export function extractBillingPeriods(blocks: EvidenceBlock[]) {
  const entities: AnalyzerEntity<string>[] = [];

  blocks.forEach((block) => {
    const matches: Array<[RegExp, string]> = [
      [/\b(?:monthly|per month|\/mo|\/month)\b/i, "month"],
      [/\b(?:yearly|annually|annual|per year|\/yr|\/year)\b/i, "year"],
      [/\b(?:weekly|per week|\/wk|\/week)\b/i, "week"],
    ];

    matches.forEach(([pattern, value]) => {
      const match = block.text.match(pattern)?.[0];

      if (!match) return;

      entities.push({
        id: `${block.id}:billing:${value}`,
        type: "billing_period",
        value: match,
        normalized_value: value,
        source_block_id: block.id,
        source_url: block.final_url,
        evidence_text: block.text.slice(0, 220),
        context_role: block.role,
        confidence: ["pricing_card", "pricing_table", "billing_toggle"].includes(block.role) ? "high" : "medium",
        confidence_score: ["pricing_card", "pricing_table", "billing_toggle"].includes(block.role) ? 0.88 : 0.68,
        accepted: ["pricing_card", "pricing_table", "billing_toggle", "pricing_section"].includes(block.role),
        rejection_reason: ["pricing_card", "pricing_table", "billing_toggle", "pricing_section"].includes(block.role)
          ? null
          : "billing_period_outside_verified_pricing_context",
      });
    });
  });

  return entities;
}
