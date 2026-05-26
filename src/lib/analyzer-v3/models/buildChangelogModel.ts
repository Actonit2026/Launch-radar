import type { AnalyzerEntity, ChangelogModelV3, EvidenceBlock } from "@/lib/analyzer-v3/types";
import { evidenceFromEntity, uniqueEvidence } from "@/lib/analyzer-v3/validation/evidence";

export function buildChangelogModel({
  blocks,
  dates,
}: {
  blocks: EvidenceBlock[];
  dates: AnalyzerEntity<string>[];
}): ChangelogModelV3 {
  const changelogBlocks = blocks.filter((block) => ["changelog_entry", "release_note", "update_log"].includes(block.role));
  const entries = changelogBlocks.slice(0, 8).map((block) => {
    const date = dates.find((entity) => entity.source_block_id === block.id);
    const confidence = block.page_type === "changelog" ? "high" as const : "medium" as const;
    const title =
      block.local_heading ??
      block.text.split(/\n+/).find((line) => line.trim().length >= 6 && line.trim().length <= 90)?.trim() ??
      "Update";

    return {
      title,
      date: date?.value ?? null,
      evidence: [
        {
          source_url: block.final_url,
          evidence_text: block.text.slice(0, 260),
          source_block_id: block.id,
          confidence,
        },
      ],
      confidence,
    };
  });

  return {
    status: entries.length && blocks.some((block) => block.page_type === "changelog") ? "verified" : "unknown",
    entries,
    latest_update: dates[0]?.value ?? entries[0]?.date ?? null,
    evidence: uniqueEvidence([
      ...entries.flatMap((entry) => entry.evidence),
      ...dates.map(evidenceFromEntity),
    ]),
    confidence: entries.length && blocks.some((block) => block.page_type === "changelog") ? "high" : "low",
  };
}
