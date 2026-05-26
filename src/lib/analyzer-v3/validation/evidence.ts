import type { AnalyzerEntity, ModelEvidence } from "@/lib/analyzer-v3/types";

export function evidenceFromEntity(entity: AnalyzerEntity): ModelEvidence {
  return {
    source_url: entity.source_url,
    evidence_text: entity.evidence_text,
    source_block_id: entity.source_block_id,
    confidence: entity.confidence,
  };
}

export function uniqueEvidence(evidence: ModelEvidence[]) {
  return Array.from(
    new Map(
      evidence
        .filter((item) => item.source_url && item.evidence_text)
        .map((item) => [`${item.source_url}:${item.evidence_text.toLowerCase()}`, item]),
    ).values(),
  );
}
