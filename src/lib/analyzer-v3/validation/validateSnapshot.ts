import { validatePricingModel } from "@/lib/analyzer-v3/validation/validatePricingModel";
import type { AnalyzerV3Result, AnalyzerV3Validity, BusinessModelV3 } from "@/lib/analyzer-v3/types";

export function validateBusinessModelSnapshot(model: BusinessModelV3) {
  const reasons: string[] = [];
  const pricing = validatePricingModel(model.pricing);

  reasons.push(...pricing.reasons);

  if (!model.evidence_summary.length) reasons.push("missing_evidence_summary");
  if (model.availability.status === "blocked") reasons.push("homepage_blocked");
  if (
    !model.homepage.headline &&
    model.pricing.status === "no_public_pricing" &&
    model.features.status === "unknown" &&
    !model.cta.primary_cta
  ) {
    reasons.push("no_meaningful_verified_model");
  }

  let validity: AnalyzerV3Validity = "verified";

  if (model.availability.status === "blocked") validity = "blocked";
  else if (model.availability.status === "missing" || model.availability.status === "unavailable") validity = "unavailable";
  else if (reasons.includes("no_meaningful_verified_model") || reasons.includes("missing_evidence_summary")) validity = "unknown";
  else if (reasons.length || model.missing_data.length >= 2) validity = "partial";

  return {
    valid: validity === "verified" || validity === "partial",
    validity,
    reasons,
  };
}

export function validateAnalyzerV3Result(result: AnalyzerV3Result) {
  return validateBusinessModelSnapshot(result.business_model);
}
