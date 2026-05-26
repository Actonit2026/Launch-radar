import { extractBillingPeriods } from "@/lib/analyzer-v3/entities/extractBillingPeriods";
import { extractCtas } from "@/lib/analyzer-v3/entities/extractCtas";
import { extractDates } from "@/lib/analyzer-v3/entities/extractDates";
import { extractFeatures } from "@/lib/analyzer-v3/entities/extractFeatures";
import { extractHeadlines } from "@/lib/analyzer-v3/entities/extractHeadlines";
import { extractLimits } from "@/lib/analyzer-v3/entities/extractLimits";
import { extractMoney } from "@/lib/analyzer-v3/entities/extractMoney";
import { extractPlans } from "@/lib/analyzer-v3/entities/extractPlans";
import { buildAvailabilityModel } from "@/lib/analyzer-v3/models/buildAvailabilityModel";
import { buildChangelogModel } from "@/lib/analyzer-v3/models/buildChangelogModel";
import { buildCtaModel } from "@/lib/analyzer-v3/models/buildCtaModel";
import { buildFeatureModel } from "@/lib/analyzer-v3/models/buildFeatureModel";
import { buildHomepageModel } from "@/lib/analyzer-v3/models/buildHomepageModel";
import { buildPricingModel } from "@/lib/analyzer-v3/models/buildPricingModel";
import { uniqueEvidence } from "@/lib/analyzer-v3/validation/evidence";
import type {
  AnalyzerEntity,
  BusinessModelV3,
  EvidenceBlock,
  MoneyValue,
  PageBundle,
} from "@/lib/analyzer-v3/types";

function categoryFromHeadline(headline: string | null) {
  if (!headline) return null;
  if (/\banalytics\b/i.test(headline)) return "Analytics";
  if (/\bproposal\b/i.test(headline)) return "Proposal software";
  if (/\bwebsite|web analytics\b/i.test(headline)) return "Web analytics";
  if (/\bai\b/i.test(headline)) return "AI software";
  return null;
}

function overallCompleteness(model: BusinessModelV3) {
  return Math.round(
    (model.homepage.completeness +
      model.pricing.completeness +
      model.features.completeness +
      (model.cta.primary_cta ? 80 : 20)) /
      4,
  );
}

function overallConfidence(model: BusinessModelV3) {
  const high = [
    model.homepage.confidence,
    model.pricing.confidence,
    model.cta.confidence,
    model.features.confidence,
  ].filter((confidence) => confidence === "high").length;

  if (high >= 3) return "high" as const;
  if (high >= 1) return "medium" as const;
  return "low" as const;
}

export function extractAnalyzerEntities(blocks: EvidenceBlock[]) {
  const money = extractMoney(blocks);
  const plans = extractPlans({ blocks, money });
  const limits = extractLimits(blocks);
  const billingPeriods = extractBillingPeriods(blocks);
  const ctas = extractCtas(blocks);
  const headlines = extractHeadlines(blocks);
  const features = extractFeatures(blocks);
  const dates = extractDates(blocks);

  return {
    money,
    plans,
    limits,
    billingPeriods,
    ctas,
    headlines,
    features,
    dates,
    all: [
      ...money,
      ...plans,
      ...limits,
      ...billingPeriods,
      ...ctas,
      ...headlines,
      ...features,
      ...dates,
    ] as AnalyzerEntity[],
  };
}

export function buildBusinessModel({
  bundle,
  blocks,
}: {
  bundle: PageBundle;
  blocks: EvidenceBlock[];
}): {
  businessModel: BusinessModelV3;
  acceptedEntities: AnalyzerEntity[];
  rejectedEntities: AnalyzerEntity[];
} {
  const entities = extractAnalyzerEntities(blocks);
  const availability = buildAvailabilityModel(bundle);
  const homepage = buildHomepageModel({
    blocks,
    headlineEntities: entities.headlines,
  });
  const cta = buildCtaModel(entities.ctas);
  const pricing = buildPricingModel({
    blocks,
    money: entities.money as AnalyzerEntity<MoneyValue>[],
    plans: entities.plans,
    limits: entities.limits,
    ctas: entities.ctas,
  });
  const features = buildFeatureModel(entities.features);
  const changelog = buildChangelogModel({
    blocks,
    dates: entities.dates,
  });
  const missingData = [
    homepage.headline ? null : "homepage_headline_unknown",
    pricing.status === "no_public_pricing" ? "public_pricing_not_detected" : null,
    features.status === "unknown" ? "features_unknown" : null,
    changelog.status === "unknown" ? "changelog_unknown" : null,
  ].filter((item): item is string => Boolean(item));
  const evidenceSummary = uniqueEvidence([
    ...availability.evidence,
    ...homepage.evidence,
    ...cta.evidence,
    ...pricing.evidence,
    ...features.evidence,
    ...changelog.evidence,
  ]).slice(0, 40);
  const businessModel: BusinessModelV3 = {
    company: homepage.company_name,
    category: categoryFromHeadline(homepage.headline),
    availability,
    availability_model: availability,
    homepage,
    homepage_model: homepage,
    positioning: homepage,
    positioning_model: homepage,
    cta,
    cta_model: cta,
    pricing,
    pricing_model: pricing,
    features,
    feature_model: features,
    changelog,
    changelog_model: changelog,
    confidence: "low",
    completeness: 0,
    evidence_summary: evidenceSummary,
    missing_data: missingData,
    warnings: [...pricing.warnings],
  };

  businessModel.completeness = overallCompleteness(businessModel);
  businessModel.confidence = overallConfidence(businessModel);

  return {
    businessModel,
    acceptedEntities: entities.all.filter((entity) => entity.accepted),
    rejectedEntities: entities.all.filter((entity) => !entity.accepted),
  };
}
