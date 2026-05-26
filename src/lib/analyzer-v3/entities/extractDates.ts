import type { AnalyzerEntity, EvidenceBlock } from "@/lib/analyzer-v3/types";

const datePattern =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}\b|\b20\d{2}-\d{2}-\d{2}\b/gi;

export function extractDates(blocks: EvidenceBlock[]) {
  const entities: AnalyzerEntity<string>[] = [];

  blocks
    .filter((block) => ["changelog_entry", "release_note", "update_log"].includes(block.role))
    .forEach((block) => {
      for (const match of block.text.matchAll(datePattern)) {
        entities.push({
          id: `${block.id}:date:${entities.length}`,
          type: "release_date",
          value: match[0],
          normalized_value: match[0],
          source_block_id: block.id,
          source_url: block.final_url,
          evidence_text: block.text.slice(0, 260),
          context_role: block.role,
          confidence: "medium",
          confidence_score: 0.76,
          accepted: true,
          rejection_reason: null,
        });
      }
    });

  return entities;
}
