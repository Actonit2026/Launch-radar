import type { BusinessModelV3, PricingModelV3 } from "@/lib/analyzer-v3/types";

function planKey(plan: PricingModelV3["plans"][number]) {
  return `${plan.name}:${plan.currency ?? ""}:${plan.price ?? "custom"}:${plan.billing_period ?? ""}`;
}

export function comparePricingModels(previous: PricingModelV3, next: PricingModelV3) {
  const changes: Array<{ type: string; summary: string; confidence: number }> = [];
  const previousPlans = new Map(previous.plans.map((plan) => [plan.name.toLowerCase(), plan]));
  const nextPlans = new Map(next.plans.map((plan) => [plan.name.toLowerCase(), plan]));

  nextPlans.forEach((plan, key) => {
    const old = previousPlans.get(key);

    if (!old) {
      changes.push({ type: "pricing_plan_added", summary: `New pricing plan added: ${plan.name}.`, confidence: 0.84 });
      return;
    }

    if (planKey(old) !== planKey(plan)) {
      changes.push({
        type: "pricing_model_changed",
        summary: `${plan.name} plan changed from ${old.currency ?? ""} ${old.price ?? "custom"} to ${plan.currency ?? ""} ${plan.price ?? "custom"}.`,
        confidence: 0.9,
      });
    }
  });

  previousPlans.forEach((plan, key) => {
    if (!nextPlans.has(key)) {
      changes.push({ type: "pricing_plan_removed", summary: `Pricing plan removed: ${plan.name}.`, confidence: 0.82 });
    }
  });

  return changes;
}

export function pricingChangeAllowed(previous: BusinessModelV3, next: BusinessModelV3) {
  return previous.pricing.confidence !== "low" && next.pricing.confidence !== "low";
}
