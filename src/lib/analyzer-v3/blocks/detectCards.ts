import type { EvidenceBlock } from "@/lib/analyzer-v3/types";

export function detectCards(blocks: EvidenceBlock[]) {
  return blocks.filter(
    (block) =>
      /card|tile|plan|tier/i.test(
        `${block.css_classes.join(" ")} ${block.id_attribute ?? ""} ${block.local_heading ?? ""}`,
      ) ||
      ["pricing_card", "feature_card"].includes(block.role),
  );
}
