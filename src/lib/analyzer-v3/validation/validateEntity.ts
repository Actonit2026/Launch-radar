import type { AnalyzerEntity } from "@/lib/analyzer-v3/types";

export function validateEntity(entity: AnalyzerEntity) {
  const reasons: string[] = [];

  if (!entity.source_url) reasons.push("missing_source_url");
  if (!entity.evidence_text) reasons.push("missing_evidence_text");
  if (!entity.source_block_id) reasons.push("missing_source_block");
  if (entity.confidence_score < 0.6) reasons.push("confidence_below_partial_threshold");
  if (!entity.accepted && entity.confidence_score >= 0.8) reasons.push("high_confidence_entity_marked_rejected");

  return {
    valid: reasons.length === 0 && entity.accepted,
    reasons,
  };
}
