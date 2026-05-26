import type { EvidenceBlock } from "@/lib/analyzer-v3/types";

export function groupSiblingBlocks(blocks: EvidenceBlock[]) {
  const groups = new Map<string, EvidenceBlock[]>();

  blocks.forEach((block) => {
    const key = block.sibling_group_id ?? "ungrouped";
    groups.set(key, [...(groups.get(key) ?? []), block]);
  });

  return Array.from(groups.entries()).map(([id, items]) => ({
    id,
    role_counts: items.reduce<Record<string, number>>((counts, block) => {
      counts[block.role] = (counts[block.role] ?? 0) + 1;
      return counts;
    }, {}),
    blocks: items,
  }));
}
