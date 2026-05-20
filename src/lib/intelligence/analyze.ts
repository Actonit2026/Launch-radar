import { analyzeChangelog } from "@/lib/intelligence/changelog";
import { analyzeCtas } from "@/lib/intelligence/ctas";
import { analyzeFeatures } from "@/lib/intelligence/features";
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
  const facts: StructuredFact[] = [
    ...pricing.facts,
    ...positioning.facts,
    ...ctas.ctas,
    ...features.features,
    ...(changelog.changelogDetected ? [changelog.changelogDetected] : []),
    ...(changelog.lastVisibleUpdateDate
      ? [changelog.lastVisibleUpdateDate]
      : []),
    ...changelog.recentUpdateTitles,
  ];
  const warnings = [
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
    pricing,
    positioning,
    ctas,
    features,
    changelog,
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
