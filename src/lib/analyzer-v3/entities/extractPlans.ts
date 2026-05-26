import type { AnalyzerEntity, EvidenceBlock, MoneyValue } from "@/lib/analyzer-v3/types";

const planNamePattern =
  /\b(Free|Starter|Start|Basic|Plus|Pro|Professional|Premium|Team|Teams|Business|Growth|Scale|Enterprise|Custom|Agency|Creator|Launch|Personal|Core)\b/i;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function planNameFromBlock(block: EvidenceBlock) {
  const heading = block.local_heading || block.heading_chain[block.heading_chain.length - 1] || "";
  const headingMatch = heading.match(planNamePattern)?.[1];

  if (headingMatch) {
    return headingMatch === "Start" ? "Starter" : headingMatch;
  }

  const lineMatch = block.text
    .split(/\n+/)
    .map(clean)
    .find((line) => line.length <= 50 && planNamePattern.test(line))
    ?.match(planNamePattern)?.[1];

  if (lineMatch) {
    return lineMatch === "Start" ? "Starter" : lineMatch;
  }

  return null;
}

export function extractPlans({
  blocks,
  money,
}: {
  blocks: EvidenceBlock[];
  money: AnalyzerEntity<MoneyValue>[];
}) {
  const entities: AnalyzerEntity<string>[] = [];

  blocks
    .filter((block) => ["pricing_card", "pricing_table", "plan_comparison", "pricing_section"].includes(block.role))
    .forEach((block) => {
      const name = planNameFromBlock(block);

      if (!name) {
        return;
      }

      const hasAcceptedMoney = money.some((entity) => entity.source_block_id === block.id && entity.accepted);
      const free = /\bfree(?: forever| plan)?\b/i.test(block.text);
      const contactSales = /\b(?:contact sales|custom pricing|talk to sales|enterprise)\b/i.test(block.text);

      entities.push({
        id: `${block.id}:plan:${name.toLowerCase()}`,
        type: "plan_name",
        value: name,
        normalized_value: name,
        source_block_id: block.id,
        source_url: block.final_url,
        evidence_text: block.text.slice(0, 260),
        context_role: block.role,
        confidence: hasAcceptedMoney || free || contactSales ? "high" : "medium",
        confidence_score: hasAcceptedMoney || free || contactSales ? 0.9 : 0.7,
        accepted: true,
        rejection_reason: null,
      });
    });

  return Array.from(
    new Map(entities.map((entity) => [`${entity.source_block_id}:${entity.value.toLowerCase()}`, entity])).values(),
  );
}
