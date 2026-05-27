import type {
  AnalyzerV3Confidence,
  BusinessModelV3,
  ModelEvidence,
  PricingModelV3,
  PricingPlanV3,
} from "@/lib/analyzer-v3/types";

export type V3PricingDisplayState =
  | "public_pricing"
  | "contact_sales"
  | "pricing_unclear"
  | "pricing_scanning"
  | "no_public_pricing";

export type V3PricingDisplayOption = {
  key: string;
  state: V3PricingDisplayState;
  kind: "plan" | "usage_tier" | "contact_sales";
  label: string;
  text: string;
  price: number | null;
  currency: PricingPlanV3["currency"];
  billing_period: PricingPlanV3["billing_period"];
  source_block_id: string | null;
  confidence: AnalyzerV3Confidence;
  evidence: ModelEvidence[];
};

export type V3PricingDisplayContract = {
  status: V3PricingDisplayState;
  accepted_options: V3PricingDisplayOption[];
  displayed_options: V3PricingDisplayOption[];
  invariant_ok: boolean;
  invariant_reason: string | null;
  warnings: string[];
};

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function optionKey({
  kind,
  label,
  price,
  currency,
  billing_period,
  source_block_id,
}: Pick<
  V3PricingDisplayOption,
  "kind" | "label" | "price" | "currency" | "billing_period" | "source_block_id"
>) {
  return [
    kind,
    normalizeToken(label),
    price === null ? "custom" : String(price),
    currency ?? "no-currency",
    billing_period ?? "unknown-period",
    source_block_id ?? "unknown-block",
  ].join("|");
}

function moneyText(plan: PricingPlanV3) {
  if (plan.price === null || !plan.currency) {
    return "Custom pricing";
  }

  const period =
    plan.billing_period && plan.billing_period !== "unknown"
      ? `/${plan.billing_period}`
      : "";

  return `${plan.currency} ${plan.price}${period}`;
}

function optionText(plan: PricingPlanV3) {
  const pieces = [
    moneyText(plan),
    plan.limits.slice(0, 2).join(", "),
    plan.included_features.slice(0, 2).join(", "),
  ].filter(Boolean);

  return pieces.join(" - ");
}

function confidenceAllowsDisplay(confidence: AnalyzerV3Confidence) {
  return confidence === "high" || confidence === "medium";
}

function optionFromPlan(
  plan: PricingPlanV3,
  kind: "plan" | "usage_tier",
): V3PricingDisplayOption | null {
  if (!confidenceAllowsDisplay(plan.confidence)) {
    return null;
  }

  const label = plan.name?.trim();

  if (!label || /^plan\s*\d+$/i.test(label)) {
    return null;
  }

  if (!plan.evidence.length) {
    return null;
  }

  const option = {
    key: "",
    state: "public_pricing" as const,
    kind,
    label,
    text: optionText(plan),
    price: plan.price,
    currency: plan.currency,
    billing_period: plan.billing_period,
    source_block_id: plan.source_block_id,
    confidence: plan.confidence,
    evidence: plan.evidence,
  };

  return {
    ...option,
    key: optionKey(option),
  };
}

function contactSalesOption(pricing: PricingModelV3): V3PricingDisplayOption | null {
  if (!pricing.contact_sales) {
    return null;
  }

  const evidence = pricing.evidence.filter((item) =>
    /contact|sales|custom|enterprise/i.test(item.evidence_text),
  );

  if (!evidence.length && pricing.confidence === "low") {
    return null;
  }

  const option = {
    key: "",
    state: "contact_sales" as const,
    kind: "contact_sales" as const,
    label: "Contact sales",
    text: "Contact sales is visible on the public site.",
    price: null,
    currency: null,
    billing_period: null,
    source_block_id: evidence[0]?.source_block_id ?? null,
    confidence: pricing.confidence,
    evidence: evidence.length ? evidence : pricing.evidence.slice(0, 1),
  };

  if (!option.evidence.length) {
    return null;
  }

  return {
    ...option,
    key: optionKey(option),
  };
}

function mergeDuplicateOptions(options: V3PricingDisplayOption[]) {
  const byStableKey = new Map<string, V3PricingDisplayOption>();

  for (const option of options) {
    const stableKey = [
      option.kind,
      normalizeToken(option.label),
      option.price === null ? "custom" : String(option.price),
      option.currency ?? "no-currency",
      option.billing_period ?? "unknown-period",
    ].join("|");
    const existing = byStableKey.get(stableKey);

    if (!existing) {
      byStableKey.set(stableKey, option);
      continue;
    }

    byStableKey.set(stableKey, {
      ...existing,
      evidence: [...existing.evidence, ...option.evidence],
    });
  }

  return Array.from(byStableKey.values());
}

export function acceptedV3PricingOptions(
  pricing: PricingModelV3,
): V3PricingDisplayOption[] {
  return mergeDuplicateOptions([
    ...pricing.plans
      .map((plan) => optionFromPlan(plan, "plan"))
      .filter((option): option is V3PricingDisplayOption => Boolean(option)),
    ...pricing.usage_tiers
      .map((plan) => optionFromPlan(plan, "usage_tier"))
      .filter((option): option is V3PricingDisplayOption => Boolean(option)),
    contactSalesOption(pricing),
  ].filter((option): option is V3PricingDisplayOption => Boolean(option)));
}

export function buildV3PricingDisplayContract(
  businessModel: Pick<BusinessModelV3, "pricing">,
  displayedOptions?: V3PricingDisplayOption[],
): V3PricingDisplayContract {
  const accepted = acceptedV3PricingOptions(businessModel.pricing);
  const displayed = displayedOptions ?? accepted;
  const acceptedKeys = new Set(accepted.map((option) => option.key));
  const displayedSubset = displayed.every((option) => acceptedKeys.has(option.key));
  const countOk = displayed.length <= accepted.length;
  const invariantOk = displayedSubset && countOk;
  const warnings = [...businessModel.pricing.warnings];

  if (!invariantOk) {
    warnings.push("Pricing display blocked because displayed options exceeded accepted V3 options.");
  }

  return {
    status: invariantOk
      ? businessModel.pricing.status === "public_pricing" && accepted.length
        ? "public_pricing"
        : businessModel.pricing.status === "contact_sales" || accepted.some((option) => option.state === "contact_sales")
          ? "contact_sales"
          : businessModel.pricing.status === "pricing_scanning"
            ? "pricing_scanning"
            : businessModel.pricing.status === "no_public_pricing"
              ? "no_public_pricing"
              : "pricing_unclear"
      : "pricing_unclear",
    accepted_options: accepted,
    displayed_options: invariantOk ? displayed : [],
    invariant_ok: invariantOk,
    invariant_reason: invariantOk
      ? null
      : !countOk
        ? "displayed_count_exceeds_accepted_count"
        : "displayed_options_not_subset_of_accepted_options",
    warnings,
  };
}

export function pricingDisplayCounts(businessModel: Pick<BusinessModelV3, "pricing">) {
  const contract = buildV3PricingDisplayContract(businessModel);

  return {
    accepted_price_count: contract.accepted_options.length,
    displayed_price_count: contract.displayed_options.length,
    rejected_price_count: businessModel.pricing.rejected_candidates.length,
    dangerous_output: !contract.invariant_ok,
  };
}
