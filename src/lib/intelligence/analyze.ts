import { analyzeChangelog } from "@/lib/intelligence/changelog";
import { analyzeCtas } from "@/lib/intelligence/ctas";
import { analyzeFeatures } from "@/lib/intelligence/features";
import {
  buildBusinessModels,
  businessModelFacts,
} from "@/lib/intelligence/models";
import { analyzePositioning } from "@/lib/intelligence/positioning";
import { analyzePricing } from "@/lib/intelligence/pricing";
import type {
  PageAnalysisInput,
  PageIntelligence,
  StructuredFact,
} from "@/lib/intelligence/types";

export function analyzePageIntelligence({
  pageType,
  scrape,
}: PageAnalysisInput): PageIntelligence {
  const pricing = analyzePricing(scrape, pageType);
  const positioning = analyzePositioning(scrape, pageType);
  const ctas = analyzeCtas(scrape);
  const features = analyzeFeatures(scrape, pageType);
  const changelog = analyzeChangelog(scrape, pageType);
  const models = buildBusinessModels({
    scrape,
    pageType,
    pricing,
    positioning,
    ctas,
    features,
    changelog,
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
    ...pricing.warnings,
    ...positioning.warnings,
    ...ctas.warnings,
    ...features.warnings,
    ...changelog.warnings,
  ];

  return {
    sourceUrl: scrape.finalUrl,
    pageType,
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
  FeatureAnalysis,
  FeatureFact,
  IntelligenceStatus,
  NormalizedPrice,
  PageAnalysisInput,
  PageIntelligence,
  PositioningAnalysis,
  PricingAnalysis,
  StructuredFact,
} from "@/lib/intelligence/types";
