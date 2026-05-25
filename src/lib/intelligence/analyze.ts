import { analyzeChangelog } from "@/lib/intelligence/changelog";
import { analyzeCtas } from "@/lib/intelligence/ctas";
import { analyzeFeatures } from "@/lib/intelligence/features";
import {
  buildBusinessModels,
  businessModelFacts,
} from "@/lib/intelligence/models";
import { validatePageForIntelligence } from "@/lib/intelligence/page-validation";
import { analyzePositioning } from "@/lib/intelligence/positioning";
import { analyzePricing } from "@/lib/intelligence/pricing";
import type {
  ChangelogAnalysis,
  CtaAnalysis,
  FeatureAnalysis,
  PageAnalysisInput,
  PageIntelligence,
  PositioningAnalysis,
  PricingAnalysis,
  StructuredFact,
} from "@/lib/intelligence/types";

function warningList(warning?: string) {
  return warning ? [warning] : [];
}

function unavailablePricing(warning?: string): PricingAnalysis {
  return {
    status: "unavailable",
    facts: [],
    items: [],
    selectedItem: null,
    debugCandidates: [],
    freePlan: null,
    paidPlans: [],
    lowestPrice: null,
    highestPrice: null,
    contactSales: null,
    pricingTierCount: null,
    planNames: [],
    warnings: warningList(warning),
    debug: {
      candidates: [],
      selected_candidate: null,
      rejected_candidates: [],
    },
  };
}

function unavailablePositioning(warning?: string): PositioningAnalysis {
  return {
    status: "unclear",
    homepageHeadline: null,
    subheadline: null,
    productCategory: null,
    targetCustomer: null,
    mainValueProp: null,
    keyUseCase: null,
    facts: [],
    warnings: warningList(warning),
  };
}

function unavailableCtas(warning?: string): CtaAnalysis {
  return {
    status: "unavailable",
    primaryCta: null,
    secondaryCta: null,
    ctas: [],
    warnings: warningList(warning),
  };
}

function unavailableFeatures(warning?: string): FeatureAnalysis {
  return {
    status: "unavailable",
    features: [],
    warnings: warningList(warning),
  };
}

function unavailableChangelog(warning?: string): ChangelogAnalysis {
  return {
    status: "unavailable",
    changelogDetected: null,
    changelogUrl: null,
    lastVisibleUpdateDate: null,
    recentUpdateTitles: [],
    confidence: "low",
    evidenceText: null,
    warnings: warningList(warning),
  };
}

function extractionGates(pageType: PageAnalysisInput["pageType"], allowed: boolean) {
  if (!allowed) {
    return {
      pricing: false,
      positioning: false,
      cta: false,
      features: false,
      momentum: false,
      trust: false,
      category: false,
    };
  }

  return {
    pricing: pageType === "homepage" || pageType === "pricing",
    positioning: pageType === "homepage" || pageType === "product" || pageType === "features",
    cta: pageType === "homepage" || pageType === "pricing" || pageType === "product",
    features: pageType === "homepage" || pageType === "features" || pageType === "product",
    momentum: pageType === "changelog",
    trust: pageType === "homepage" || pageType === "product",
    category: pageType === "homepage" || pageType === "product" || pageType === "features",
  };
}

export function analyzePageIntelligence({
  pageType,
  scrape,
  homepageScrape,
}: PageAnalysisInput): PageIntelligence {
  const pageValidation = validatePageForIntelligence({
    requestedPageType: pageType,
    scrape,
    homepageScrape,
  });
  const gates = extractionGates(pageType, pageValidation.extraction_allowed);
  const skipWarning = pageValidation.extraction_allowed
    ? undefined
    : `Extraction skipped because page type validation status is ${pageValidation.status}.`;
  const pricing = gates.pricing ? analyzePricing(scrape, pageType) : unavailablePricing(skipWarning);
  const positioning = gates.positioning
    ? analyzePositioning(scrape, pageType)
    : unavailablePositioning(skipWarning);
  const ctas = gates.cta ? analyzeCtas(scrape) : unavailableCtas(skipWarning);
  const features = gates.features
    ? analyzeFeatures(scrape, pageType)
    : unavailableFeatures(skipWarning);
  const changelog = gates.momentum
    ? analyzeChangelog(scrape, pageType)
    : unavailableChangelog(skipWarning);
  const models = buildBusinessModels({
    scrape,
    pageType,
    pricing,
    positioning,
    ctas,
    features,
    changelog,
    extractionGates: gates,
  });
  const pricingWithModel = {
    ...pricing,
    model: models.pricing,
  };
  const facts: StructuredFact[] = [
    ...pricingWithModel.facts,
    ...positioning.facts,
    ...ctas.ctas,
    ...features.features,
    ...(changelog.changelogDetected ? [changelog.changelogDetected] : []),
    ...(changelog.lastVisibleUpdateDate
      ? [changelog.lastVisibleUpdateDate]
      : []),
    ...changelog.recentUpdateTitles,
    ...businessModelFacts(models),
  ];
  const warnings = [
    ...(scrape.warnings ?? []),
    ...pageValidation.warnings,
    ...pricing.warnings,
    ...positioning.warnings,
    ...ctas.warnings,
    ...features.warnings,
    ...changelog.warnings,
  ];

  return {
    sourceUrl: scrape.finalUrl,
    pageType,
    detectedPageType: pageValidation.detected_page_type,
    pageValidation,
    validForIntelligence: pageValidation.extraction_allowed,
    intelligenceStatus: pageValidation.extraction_allowed
      ? "valid"
      : "invalid_for_intelligence",
    title: scrape.title,
    fetchStatus: scrape.status,
    contentHash: scrape.hash,
    extractedTextLength: scrape.rawText.length,
    pricing: pricingWithModel,
    positioning,
    ctas,
    features,
    changelog,
    models,
    facts,
    warnings,
  };
}

export function analyzePagesIntelligence(inputs: PageAnalysisInput[]) {
  return inputs.map(analyzePageIntelligence);
}

export type {
  ChangelogAnalysis,
  Confidence,
  CtaAnalysis,
  CtaFact,
  DetectedPageType,
  FeatureAnalysis,
  FeatureFact,
  IntelligenceStatus,
  NormalizedPrice,
  PageAnalysisInput,
  PageIntelligence,
  PageValidation,
  PositioningAnalysis,
  PricingAnalysis,
  StructuredFact,
} from "@/lib/intelligence/types";
