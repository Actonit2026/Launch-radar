import type { EvidenceBlock } from "@/lib/analyzer-v3/types";

export function buildBlockTree(blocks: EvidenceBlock[]) {
  return blocks.map((block) => ({
    id: block.id,
    parent_heading: block.parent_heading,
    heading_chain: block.heading_chain,
    role: block.role,
    sibling_group_id: block.sibling_group_id,
    child_count: block.child_count,
  }));
}
