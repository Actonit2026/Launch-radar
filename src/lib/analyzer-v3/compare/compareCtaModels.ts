import type { CtaModelV3 } from "@/lib/analyzer-v3/types";

export function compareCtaModels(previous: CtaModelV3, next: CtaModelV3) {
  if (!previous.primary_cta || !next.primary_cta || previous.primary_cta === next.primary_cta) {
    return [];
  }

  return [
    {
      type: "cta_changed",
      summary: `Primary CTA changed from "${previous.primary_cta}" to "${next.primary_cta}".`,
      confidence: Math.min(previous.confidence === "high" ? 0.9 : 0.7, next.confidence === "high" ? 0.9 : 0.7),
    },
  ];
}
