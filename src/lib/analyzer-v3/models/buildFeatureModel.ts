import type { AnalyzerEntity, FeatureModelV3 } from "@/lib/analyzer-v3/types";
import { evidenceFromEntity, uniqueEvidence } from "@/lib/analyzer-v3/validation/evidence";

type FeatureValue = { name: string; description?: string };

function categoryFor(value: string) {
  if (/\b(?:integration|api|connect)\b/i.test(value)) return "integrations";
  if (/\b(?:analytics|report|dashboard|insight)\b/i.test(value)) return "analytics";
  if (/\b(?:automation|workflow|template)\b/i.test(value)) return "workflow";
  if (/\b(?:security|permission|compliance)\b/i.test(value)) return "security";
  return "product";
}

export function buildFeatureModel(featureEntities: AnalyzerEntity<FeatureValue>[]): FeatureModelV3 {
  const accepted = featureEntities.filter((entity) => entity.accepted);
  const capabilities = accepted.slice(0, 10).map((entity) => ({
    name: entity.normalized_value?.name ?? entity.value,
    description: entity.normalized_value?.description ?? null,
    evidence: [evidenceFromEntity(entity)],
    confidence: entity.confidence,
  }));
  const groups = Array.from(new Set(capabilities.map((item) => categoryFor(`${item.name} ${item.description ?? ""}`))));

  return {
    status: capabilities.length >= 3 ? "verified" : capabilities.length ? "partial" : "unknown",
    feature_groups: groups,
    capabilities,
    differentiators: capabilities
      .filter((item) => /\b(?:first|only|unique|faster|personalized|automatic|real-time)\b/i.test(`${item.name} ${item.description ?? ""}`))
      .map((item) => item.name),
    evidence: uniqueEvidence(capabilities.flatMap((item) => item.evidence)),
    confidence: capabilities.length >= 3 ? "high" : capabilities.length ? "medium" : "low",
    completeness: Math.min(100, capabilities.length * 18),
  };
}
