import type { AnalyzerEntity, EvidenceBlock } from "@/lib/analyzer-v3/types";

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isBadFeature(value: string) {
  return (
    value.length < 8 ||
    value.length > 120 ||
    /\b(?:testimonial|trusted by|privacy|terms|login|sign up|start free|book demo|pricing|copyright)\b/i.test(value)
  );
}

function featureName(block: EvidenceBlock) {
  const heading = clean(block.local_heading ?? "");

  if (heading && !isBadFeature(heading)) {
    return heading;
  }

  return block.text
    .split(/\n+/)
    .map(clean)
    .find((line) => !isBadFeature(line) && !/[.!?]$/.test(line)) ?? null;
}

export function extractFeatures(blocks: EvidenceBlock[]) {
  const entities: AnalyzerEntity<{ name: string; description?: string }>[] = [];

  blocks
    .filter((block) =>
      ["feature_card", "feature_grid", "benefit_section", "integration_section"].includes(block.role),
    )
    .forEach((block) => {
      const name = featureName(block);

      if (!name) {
        return;
      }

      const description = block.text
        .split(/\n+/)
        .map(clean)
        .find((line) => line !== name && line.length >= 20 && line.length <= 180) ?? null;

      entities.push({
        id: `${block.id}:feature`,
        type: "feature",
        value: name,
        normalized_value: {
          name,
          ...(description ? { description } : {}),
        },
        source_block_id: block.id,
        source_url: block.final_url,
        evidence_text: block.text.slice(0, 260),
        context_role: block.role,
        confidence: block.page_type === "features" ? "high" : "medium",
        confidence_score: block.page_type === "features" ? 0.86 : 0.72,
        accepted: true,
        rejection_reason: null,
      });
    });

  return Array.from(
    new Map(entities.map((entity) => [entity.value.toLowerCase(), entity])).values(),
  ).slice(0, 12);
}
