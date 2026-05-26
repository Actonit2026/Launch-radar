import type { PricingModelV3 } from "@/lib/analyzer-v3/types";

export function validatePricingModel(model: PricingModelV3) {
  const reasons: string[] = [];

  for (const plan of model.plans) {
    if (/^plan\s+\d+$/i.test(plan.name)) reasons.push("fake_plan_name");
    if (plan.name === "Free" && plan.price !== 0) reasons.push("paid_price_attached_to_free_plan");
    if (!plan.evidence.length) reasons.push(`missing_evidence:${plan.name}`);
    if (plan.price !== null && !plan.currency) reasons.push(`missing_currency:${plan.name}`);
  }

  if (model.status === "public_pricing" && !model.plans.some((plan) => plan.price !== null)) {
    reasons.push("public_pricing_without_public_price");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
