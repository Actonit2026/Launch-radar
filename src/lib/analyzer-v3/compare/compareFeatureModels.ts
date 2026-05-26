import type { FeatureModelV3 } from "@/lib/analyzer-v3/types";

export function compareFeatureModels(previous: FeatureModelV3, next: FeatureModelV3) {
  if (previous.confidence === "low" || next.confidence === "low") {
    return [];
  }

  const previousNames = new Set(previous.capabilities.map((feature) => feature.name.toLowerCase()));
  const nextNames = new Set(next.capabilities.map((feature) => feature.name.toLowerCase()));
  const added = next.capabilities.find((feature) => !previousNames.has(feature.name.toLowerCase()));
  const removed = previous.capabilities.find((feature) => !nextNames.has(feature.name.toLowerCase()));
  const changes = [];

  if (added) changes.push({ type: "feature_model_changed", summary: `New feature signal added: "${added.name}".`, confidence: 0.76 });
  if (removed) changes.push({ type: "feature_model_changed", summary: `Feature signal removed: "${removed.name}".`, confidence: 0.76 });

  return changes;
}
