import type { EvidenceBlock } from "@/lib/analyzer-v3/types";

export function detectModals(blocks: EvidenceBlock[]) {
  return blocks.filter(
    (block) =>
      block.visibility === "modal" ||
      block.role === "upgrade_modal" ||
      /modal|dialog/i.test(`${block.css_classes.join(" ")} ${block.role_attribute ?? ""}`),
  );
}
