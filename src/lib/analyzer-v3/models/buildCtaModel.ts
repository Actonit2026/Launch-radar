import type { AnalyzerEntity, CtaModelV3 } from "@/lib/analyzer-v3/types";
import { evidenceFromEntity, uniqueEvidence } from "@/lib/analyzer-v3/validation/evidence";

type CtaValue = { intent: string; destination_url: string | null; priority: number };

export function buildCtaModel(ctaEntities: AnalyzerEntity<CtaValue>[]): CtaModelV3 {
  const accepted = ctaEntities.filter((entity) => entity.accepted);
  const primary = accepted[0] ?? null;
  const secondary = accepted.find((entity) => entity.id !== primary?.id) ?? null;
  const intents = new Set(accepted.map((entity) => entity.normalized_value?.intent));
  const demoPresent = intents.has("book_demo") || intents.has("contact_sales");
  const trialPresent = intents.has("start_trial") || intents.has("sign_up") || intents.has("get_started");
  const salesMotion =
    trialPresent && demoPresent
      ? "hybrid"
      : trialPresent
        ? "self_serve"
        : demoPresent
          ? "sales_led"
          : "unknown";

  return {
    primary_cta: primary?.value ?? null,
    secondary_cta: secondary?.value ?? null,
    cta_type: (primary?.normalized_value?.intent as CtaModelV3["cta_type"] | undefined) ?? "unknown",
    cta_destination_url: primary?.normalized_value?.destination_url ?? null,
    sales_motion: salesMotion,
    trial_present: trialPresent,
    demo_present: demoPresent,
    evidence: uniqueEvidence(accepted.slice(0, 4).map(evidenceFromEntity)),
    confidence: primary ? "high" : "low",
  };
}
