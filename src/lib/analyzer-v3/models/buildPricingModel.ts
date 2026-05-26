import type {
  AnalyzerEntity,
  EvidenceBlock,
  MoneyValue,
  PricingModelV3,
  PricingPlanV3,
} from "@/lib/analyzer-v3/types";
import { evidenceFromEntity, uniqueEvidence } from "@/lib/analyzer-v3/validation/evidence";

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function nearbyPlanName(
  money: AnalyzerEntity<MoneyValue>,
  plans: AnalyzerEntity<string>[],
  block: EvidenceBlock | undefined,
) {
  const match = money.evidence_text.match(/\b(Starter|Basic|Plus|Pro|Premium|Team|Business|Growth|Scale|Enterprise)\b/i)?.[1];

  if (match) return titleCase(match);

  const explicit = plans.find((plan) => plan.source_block_id === money.source_block_id)?.value;

  if (explicit) return explicit;

  if (block?.local_heading && /\b(Starter|Basic|Plus|Pro|Premium|Team|Business|Growth|Scale|Enterprise)\b/i.test(block.local_heading)) {
    return block.local_heading;
  }

  const limit = money.evidence_text.match(
    /\b(?:up to|over|above|from)\s+[\d,.]+\s?(?:k|m|million|thousand)?\+?\s+(?:monthly\s+)?(?:pageviews?|users?|seats?|requests?|events?|visits?|sites?)\b/i,
  )?.[0];

  if (limit) {
    return limit.replace(/\s+/g, " ");
  }

  return "Public pricing";
}

function limitsForBlock(blockId: string, limitEntities: AnalyzerEntity<string>[]) {
  return limitEntities
    .filter((entity) => entity.source_block_id === blockId && entity.accepted)
    .map((entity) => entity.value)
    .slice(0, 8);
}

function ctaForBlock(blockId: string, ctas: AnalyzerEntity[]) {
  return ctas.find((entity) => entity.source_block_id === blockId && entity.accepted)?.value ?? null;
}

function billingModes(plans: PricingPlanV3[]): PricingModelV3["billing_modes"] {
  const modes = new Set<PricingModelV3["billing_modes"][number]>();

  plans.forEach((plan) => {
    if (plan.billing_period === "month") modes.add("monthly");
    if (plan.billing_period === "year") modes.add("yearly");
    if (plan.billing_period === "week") modes.add("weekly");
    if (plan.billing_period === "usage") modes.add("usage");
  });

  if (plans.some((plan) => plan.price === null && /enterprise|custom/i.test(plan.name))) {
    modes.add("custom");
  }

  return Array.from(modes);
}

function modelType(plans: PricingPlanV3[], contactSales: boolean): PricingModelV3["model_type"] {
  if (!plans.length && contactSales) return "contact_sales";
  if (plans.some((plan) => plan.billing_period === "usage" || plan.limits.some((limit) => /pageviews?|requests?|events?/i.test(limit)))) return "usage_based";
  if (plans.some((plan) => /\b(?:per|\/)\s?(?:user|seat)\b/i.test(plan.evidence.map((item) => item.evidence_text).join(" ")))) return "seat_based";
  if (plans.length && contactSales) return "mixed";
  if (plans.length) return "fixed_plans";
  return "unknown";
}

export function buildPricingModel({
  blocks,
  money,
  plans,
  limits,
  ctas,
}: {
  blocks: EvidenceBlock[];
  money: AnalyzerEntity<MoneyValue>[];
  plans: AnalyzerEntity<string>[];
  limits: AnalyzerEntity<string>[];
  ctas: AnalyzerEntity[];
}): PricingModelV3 {
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const acceptedMoney = money.filter((entity) => entity.accepted);
  const rejected = money.filter((entity) => !entity.accepted);
  const contactSalesBlocks = blocks.filter(
    (block) =>
      ["pricing_card", "pricing_table", "pricing_section", "plan_comparison"].includes(block.role) &&
      /\b(?:contact sales|custom pricing|talk to sales|enterprise)\b/i.test(block.text),
  );
  const freeBlocks = blocks.filter((block) => {
    const eligibleRole = ["pricing_card", "pricing_table", "pricing_section", "plan_comparison"].includes(block.role);
    const explicitFreePlan =
      /\b(?:free forever|free plan|free tier)\b/i.test(block.text) ||
      /^free$/i.test(block.local_heading ?? "") ||
      /(?:^|\n)\s*Free\s*(?:\n|$)/.test(block.text);
    const onlyCtaFree =
      /\b(?:sign up free|start free|try free)\b/i.test(block.text) &&
      !explicitFreePlan;

    return eligibleRole && explicitFreePlan && !onlyCtaFree;
  });
  const paidPlans = acceptedMoney.map((entity): PricingPlanV3 => {
    const value = entity.normalized_value;
    const block = blockById.get(entity.source_block_id);

    return {
      name: nearbyPlanName(entity, plans, block),
      price: value?.amount ?? null,
      currency: value?.currency ?? null,
      billing_period: value?.period ?? "unknown",
      limits: limitsForBlock(entity.source_block_id, limits),
      included_features: [],
      cta: ctaForBlock(entity.source_block_id, ctas),
      source_block_id: entity.source_block_id,
      evidence: [evidenceFromEntity(entity)],
      confidence: entity.confidence,
    };
  });
  const freePlans: PricingPlanV3[] = freeBlocks
    .filter((block) => !paidPlans.some((plan) => plan.source_block_id === block.id && plan.price && plan.price > 0))
    .map((block) => ({
      name: "Free",
      price: 0,
      currency: null,
      billing_period: null,
      limits: limitsForBlock(block.id, limits),
      included_features: [],
      cta: ctaForBlock(block.id, ctas),
      source_block_id: block.id,
      evidence: [
        {
          source_url: block.final_url,
          evidence_text: block.text.slice(0, 260),
          source_block_id: block.id,
          confidence: "high",
        },
      ],
      confidence: "high",
    }));
  const contactPlans: PricingPlanV3[] = contactSalesBlocks
    .filter((block) => !paidPlans.some((plan) => plan.source_block_id === block.id))
    .map((block) => ({
      name: /enterprise/i.test(block.text) ? "Enterprise" : "Contact sales",
      price: null,
      currency: null,
      billing_period: null,
      limits: limitsForBlock(block.id, limits),
      included_features: [],
      cta: ctaForBlock(block.id, ctas),
      source_block_id: block.id,
      evidence: [
        {
          source_url: block.final_url,
          evidence_text: block.text.slice(0, 260),
          source_block_id: block.id,
          confidence: "medium",
        },
      ],
      confidence: "medium",
    }));
  const allPlans = Array.from(
    new Map([...freePlans, ...paidPlans, ...contactPlans].map((plan) => [`${plan.name}:${plan.price ?? "custom"}:${plan.source_block_id}`, plan])).values(),
  );
  const contactSales = contactSalesBlocks.length > 0;
  const publicPricing = allPlans.some((plan) => plan.price !== null);
  const pricingLikeBlocks = blocks.filter((block) => ["pricing_card", "pricing_table", "pricing_section", "plan_comparison"].includes(block.role));
  const status: PricingModelV3["status"] =
    publicPricing
      ? "public_pricing"
      : contactSales
        ? "contact_sales"
        : pricingLikeBlocks.length || rejected.some((entity) => entity.confidence_score >= 0.6)
          ? "pricing_unclear"
          : "no_public_pricing";
  const evidence = uniqueEvidence(allPlans.flatMap((plan) => plan.evidence));
  const completeness = Math.min(100, evidence.length * 18 + allPlans.length * 16 + billingModes(allPlans).length * 8);

  return {
    status,
    page_status: status === "no_public_pricing" ? "unknown" : publicPricing || contactSales ? "verified" : "partial",
    model_type: modelType(allPlans, contactSales),
    billing_modes: billingModes(allPlans),
    plans: allPlans.filter((plan) => plan.price !== null || plan.price === 0),
    usage_tiers: allPlans.filter((plan) => plan.billing_period === "usage"),
    contact_sales: contactSales,
    free_plan: allPlans.some((plan) => plan.name === "Free"),
    evidence,
    rejected_candidates: rejected,
    confidence: publicPricing ? "high" : contactSales ? "medium" : "low",
    completeness,
    warnings: rejected.length ? ["Some pricing-like candidates were rejected by Analyzer V3 context rules."] : [],
  };
}
