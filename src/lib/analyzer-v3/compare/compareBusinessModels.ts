import { compareCtaModels } from "@/lib/analyzer-v3/compare/compareCtaModels";
import { compareFeatureModels } from "@/lib/analyzer-v3/compare/compareFeatureModels";
import { comparePositioningModels } from "@/lib/analyzer-v3/compare/comparePositioningModels";
import { comparePricingModels, pricingChangeAllowed } from "@/lib/analyzer-v3/compare/comparePricingModels";
import type { BusinessModelV3 } from "@/lib/analyzer-v3/types";

export function compareBusinessModels(previous: BusinessModelV3, next: BusinessModelV3) {
  const decisions: Array<{ type: string; summary: string; confidence: number; suppressed?: boolean; reason?: string }> = [];

  if (previous.confidence === "low" || next.confidence === "low") {
    return [
      {
        type: "alert_suppressed",
        summary: "No user-facing alert because one business model is low confidence.",
        confidence: 0,
        suppressed: true,
        reason: "low_confidence_model",
      },
    ];
  }

  if (pricingChangeAllowed(previous, next)) {
    decisions.push(...comparePricingModels(previous.pricing, next.pricing));
  } else {
    decisions.push({
      type: "pricing_alert_suppressed",
      summary: "No pricing alert because pricing model confidence was low.",
      confidence: 0,
      suppressed: true,
      reason: "low_confidence_pricing_model",
    });
  }

  decisions.push(...compareCtaModels(previous.cta, next.cta));
  decisions.push(...comparePositioningModels(previous.positioning, next.positioning));
  decisions.push(...compareFeatureModels(previous.features, next.features));

  return decisions;
}
