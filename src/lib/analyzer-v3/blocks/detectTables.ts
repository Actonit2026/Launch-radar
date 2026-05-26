import type { EvidenceBlock } from "@/lib/analyzer-v3/types";

export function detectTables(blocks: EvidenceBlock[]) {
  return blocks.filter(
    (block) =>
      block.table_shape &&
      block.table_shape.rows >= 2 &&
      block.table_shape.columns >= 2,
  );
}
