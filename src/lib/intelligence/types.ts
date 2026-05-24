import type { PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";

export type Confidence = "high" | "medium" | "low";

export type IntelligenceStatus =
  | "found"
  | "unclear"
  | "contact_sales"
  | "not_detected"
  | "unavailable";

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
  period?: "week" | "month" | "year" | "usage" | "unknown";
  unit?: "user" | "seat";
  plan?: string;
};

export type ModelEvidence = {
  source_url: string;
  evidence_text: string;
  section: string;
  confidence: Confidence;
};

export type PricingPlanModel = {
  id: string;
  name: string;
  price: number | null;
  currency: NormalizedPrice["currency"] | null;
  billing_period: "week" | "month" | "year" | "usage" | "unknown";
  billing_type:
    | "fixed"
    | "usage_based"
    | "seat_based"
    | "custom"
    | "contact_sales"
    | "unknown";
  limits: string[];
  cta: string | null;
  evidence: ModelEvidence[];
  confidence: Confidence;
  source: string;
};

export type PricingModel = {
  pricing_visibility:
    | "public"
    | "partially_public"
    | "contact_sales"
    | "hidden"
    | "unknown";
  pricing_model:
    | "free"
    | "fixed"
    | "seat_based"
    | "usage_based"
    | "contact_sales"
    | "mixed"
    | "unknown";
  plans: PricingPlanModel[];
  evidence: ModelEvidence[];
  confidence: Confidence;
};

export type PositioningModel = {
  category: string | null;
  target_customers: string[];
  use_cases: string[];
  value_props: string[];
  differentiators: string[];
  pain_points: string[];
  outcomes_promised: string[];
  evidence: ModelEvidence[];
  confidence: Confidence;
};

export type CtaModel = {
  primary_cta: string | null;
  secondary_ctas: string[];
  cta_groups: Array<{
    group:
      | "trial/signup"
      | "demo/sales"
      | "upgrade/buy"
      | "learn_more"
      | "contact"
      | "download"
      | "login/account"
      | "unknown";
    ctas: string[];
  }>;
  funnel_intent: "self_serve" | "sales_led" | "hybrid" | "unclear";
  evidence: ModelEvidence[];
  confidence: Confidence;
};

export type FeatureModel = {
  feature_categories: string[];
  features: Array<{
    name: string;
    description: string | null;
    category: string;
    evidence: ModelEvidence[];
    confidence: Confidence;
  }>;
  integrations: string[];
  workflows: string[];
  proof_points: string[];
  evidence: ModelEvidence[];
  confidence: Confidence;
};

export type MomentumModel = {
  has_changelog: boolean;
  update_sources: string[];
  recent_updates: string[];
  update_frequency_estimate: "active" | "occasional" | "unknown";
  last_visible_update: string | null;
  release_themes: string[];
  evidence: ModelEvidence[];
  confidence: Confidence;
};

export type AvailabilityModel = {
  status:
    | "live"
    | "redirected"
    | "not_found"
    | "blocked"
    | "timeout"
    | "dns_error"
    | "ssl_error"
    | "server_error"
    | "inaccessible"
    | "unknown_error";
  http_status: number | null;
  final_url: string;
  error_type: string | null;
  previously_seen: boolean;
  last_success_at: string | null;
  current_failure_at: string | null;
  business_relevance: "high" | "medium" | "low";
  evidence: ModelEvidence[];
  confidence: Confidence;
};

export type TrustModel = {
  testimonials_detected: boolean;
  customer_logos_detected: boolean;
  user_counts: string[];
  review_mentions: string[];
  security_mentions: string[];
  compliance_mentions: string[];
  evidence: ModelEvidence[];
  confidence: Confidence;
};

export type CategoryModel = {
  market_category: string | null;
  adjacent_categories: string[];
  likely_audience: string[];
  business_model_signals: string[];
  confidence: Confidence;
  evidence: ModelEvidence[];
};

export type BusinessModels = {
  pricing: PricingModel;
  positioning: PositioningModel;
  cta: CtaModel;
  features: FeatureModel;
  momentum: MomentumModel;
  availability: AvailabilityModel;
  trust: TrustModel;
  category: CategoryModel;
};

export type PricingCandidateDebug = {
  raw_text: string;
  context: string;
  source_url: string;
  section: string;
  score: number;
  accepted: boolean;
  reasons: string[];
  rejection_reason?: string;
};

export type PricingDebug = {
  candidates: PricingCandidateDebug[];
  selected_candidate: PricingCandidateDebug | null;
  rejected_candidates: PricingCandidateDebug[];
};

export type PricingAnalysis = {
  status: IntelligenceStatus;
  facts: StructuredFact[];
  model?: PricingModel;
  items: StructuredFact<NormalizedPrice>[];
  selectedItem: StructuredFact<NormalizedPrice> | null;
  debugCandidates: PricingCandidateDebug[];
  freePlan: StructuredFact | null;
  paidPlans: StructuredFact<NormalizedPrice>[];
  lowestPrice: StructuredFact<NormalizedPrice> | null;
  highestPrice: StructuredFact<NormalizedPrice> | null;
  contactSales: StructuredFact | null;
  pricingTierCount: StructuredFact<number> | null;
  planNames: StructuredFact[];
  warnings: string[];
  debug: PricingDebug;
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
  | "upgrade_buy"
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
  models: BusinessModels;
  facts: StructuredFact[];
  warnings: string[];
};

export type PageAnalysisInput = {
  pageType: PageType;
  scrape: ScrapedPage;
};
