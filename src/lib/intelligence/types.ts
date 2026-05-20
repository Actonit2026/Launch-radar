import type { PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";

export type Confidence = "high" | "medium" | "low";

export type IntelligenceStatus = "found" | "unclear" | "unavailable";

export type FactExtractionMethod =
  | "deterministic_regex"
  | "deterministic_keyword"
  | "deterministic_link"
  | "deterministic_structure";

export type StructuredFact<TNormalized = unknown> = {
  field: string;
  value: string;
  normalized_value?: TNormalized;
  confidence: Confidence;
  confidence_score: number;
  source_url: string;
  evidence_text: string;
  extraction_method: FactExtractionMethod;
};

export type NormalizedPrice = {
  amount: number;
  currency: "EUR" | "USD" | "GBP";
  period?: "month" | "year";
  unit?: "user" | "seat";
};

export type PricingAnalysis = {
  status: IntelligenceStatus;
  facts: StructuredFact[];
  freePlan: StructuredFact | null;
  paidPlans: StructuredFact<NormalizedPrice>[];
  lowestPrice: StructuredFact<NormalizedPrice> | null;
  highestPrice: StructuredFact<NormalizedPrice> | null;
  contactSales: StructuredFact | null;
  pricingTierCount: StructuredFact<number> | null;
  planNames: StructuredFact[];
  warnings: string[];
};

export type PositioningAnalysis = {
  status: IntelligenceStatus;
  homepageHeadline: StructuredFact | null;
  subheadline: StructuredFact | null;
  productCategory: StructuredFact | null;
  targetCustomer: StructuredFact | null;
  mainValueProp: StructuredFact | null;
  keyUseCase: StructuredFact | null;
  facts: StructuredFact[];
  warnings: string[];
};

export type CtaIntent =
  | "start_trial"
  | "book_demo"
  | "contact_sales"
  | "sign_up"
  | "download"
  | "view_pricing"
  | "get_started"
  | "unknown";

export type CtaFact = StructuredFact<{
  intent: CtaIntent;
  destination_url?: string;
}>;

export type CtaAnalysis = {
  status: IntelligenceStatus;
  primaryCta: CtaFact | null;
  secondaryCta: CtaFact | null;
  ctas: CtaFact[];
  warnings: string[];
};

export type FeatureFact = StructuredFact<{
  name: string;
  description?: string;
}>;

export type FeatureAnalysis = {
  status: IntelligenceStatus;
  features: FeatureFact[];
  warnings: string[];
};

export type ChangelogAnalysis = {
  status: IntelligenceStatus;
  changelogDetected: StructuredFact<boolean> | null;
  changelogUrl: string | null;
  lastVisibleUpdateDate: StructuredFact | null;
  recentUpdateTitles: StructuredFact[];
  confidence: Confidence;
  evidenceText: string | null;
  warnings: string[];
};

export type PageIntelligence = {
  sourceUrl: string;
  pageType: PageType;
  title: string;
  fetchStatus: number | null;
  contentHash: string;
  extractedTextLength: number;
  pricing: PricingAnalysis;
  positioning: PositioningAnalysis;
  ctas: CtaAnalysis;
  features: FeatureAnalysis;
  changelog: ChangelogAnalysis;
  facts: StructuredFact[];
  warnings: string[];
};

export type PageAnalysisInput = {
  pageType: PageType;
  scrape: ScrapedPage;
};
