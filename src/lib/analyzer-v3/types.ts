export type AnalyzerV3Validity =
  | "verified"
  | "partial"
  | "unknown"
  | "blocked"
  | "unavailable"
  | "invalid_for_intelligence";

export type AnalyzerV3Confidence = "high" | "medium" | "low";

export type AnalyzerV3PageType =
  | "homepage"
  | "pricing"
  | "features"
  | "changelog"
  | "docs"
  | "blog"
  | "case_study"
  | "customer_story"
  | "login"
  | "checkout"
  | "blocked"
  | "missing"
  | "duplicate_homepage"
  | "unknown";

export type BlockVisibility =
  | "visible"
  | "hidden_but_in_dom"
  | "aria_hidden"
  | "modal"
  | "collapsed";

export type BlockRole =
  | "hero"
  | "positioning"
  | "cta_section"
  | "pricing_section"
  | "pricing_card"
  | "pricing_table"
  | "plan_comparison"
  | "billing_toggle"
  | "upgrade_modal"
  | "checkout_section"
  | "feature_grid"
  | "feature_card"
  | "benefit_section"
  | "integration_section"
  | "changelog_entry"
  | "release_note"
  | "update_log"
  | "testimonial"
  | "case_study"
  | "customer_story"
  | "example_output"
  | "proposal_sample"
  | "job_example"
  | "blog_content"
  | "faq"
  | "navigation"
  | "footer"
  | "legal"
  | "cookie_banner"
  | "unknown";

export type EntityType =
  | "money"
  | "billing_period"
  | "plan_name"
  | "usage_limit"
  | "seat_limit"
  | "pageview_limit"
  | "feature"
  | "cta"
  | "headline"
  | "subheadline"
  | "target_customer"
  | "differentiation"
  | "release_date"
  | "availability_state";

export type MoneyValue = {
  amount: number;
  currency: "EUR" | "USD" | "GBP";
  period?: "week" | "month" | "year" | "usage" | "unknown";
  unit?: "user" | "seat";
};

export type SafeUrlResult = {
  input_url: string;
  canonical_url: string;
  canonical_origin: string;
  stripped_tracking_params: string[];
  warnings: string[];
};

export type FetchPageResult = {
  id: string;
  requested_url: string;
  final_url: string;
  status_code: number | null;
  fetch_method: "fetch" | "render" | "fixture" | "failed";
  content_type: string | null;
  redirected: boolean;
  blocked: boolean;
  timed_out: boolean;
  html: string;
  text: string;
  title: string;
  meta_description: string;
  html_hash: string;
  text_hash: string;
  dom_hash: string;
  fetched_at: string;
  render_required: boolean;
  render_used: boolean;
  error?: string;
  warnings: string[];
};

export type PageTypeResult = {
  requested_page_type: AnalyzerV3PageType;
  detected_page_type: AnalyzerV3PageType;
  confidence: number;
  reasons: string[];
  duplicate_of: string | null;
  extraction_allowed: boolean;
};

export type PageBundlePage = {
  page: FetchPageResult;
  requested_page_type: AnalyzerV3PageType;
  page_type_result: PageTypeResult;
};

export type PageBundle = {
  homepage: PageBundlePage | null;
  pricing_candidates: PageBundlePage[];
  optional_pages: PageBundlePage[];
  blocked_pages: PageBundlePage[];
  missing_pages: PageBundlePage[];
  duplicate_pages: PageBundlePage[];
  discovered_links: Array<{ url: string; text: string; source: string }>;
  rejected_links: Array<{ url: string; reason: string }>;
};

export type EvidenceBlock = {
  id: string;
  page_id: string;
  url: string;
  final_url: string;
  page_type: AnalyzerV3PageType;
  tag_name: string;
  dom_path: string;
  css_classes: string[];
  id_attribute: string | null;
  aria_label: string | null;
  role_attribute: string | null;
  visibility: BlockVisibility;
  text: string;
  normalized_text: string;
  heading_chain: string[];
  local_heading: string | null;
  parent_heading: string | null;
  sibling_group_id: string | null;
  sibling_index: number;
  child_count: number;
  link_count: number;
  button_texts: string[];
  nearby_links: Array<{ url: string; text: string }>;
  nearby_prices: string[];
  nearby_plan_words: string[];
  nearby_negative_words: string[];
  table_shape: { rows: number; columns: number } | null;
  list_shape: { items: number } | null;
  position_index: number;
  viewport_order_estimate: number;
  role: BlockRole;
  role_confidence: number;
  positive_signals: string[];
  negative_signals: string[];
  evidence_score: number;
};

export type AnalyzerEntity<TValue = unknown> = {
  id: string;
  type: EntityType;
  value: string;
  normalized_value: TValue | null;
  source_block_id: string;
  source_url: string;
  evidence_text: string;
  context_role: BlockRole;
  confidence: AnalyzerV3Confidence;
  confidence_score: number;
  accepted: boolean;
  rejection_reason: string | null;
};

export type ModelEvidence = {
  source_url: string;
  evidence_text: string;
  source_block_id?: string;
  confidence: AnalyzerV3Confidence;
};

export type PricingPlanV3 = {
  name: string;
  price: number | null;
  currency: MoneyValue["currency"] | null;
  billing_period: MoneyValue["period"] | null;
  limits: string[];
  included_features: string[];
  cta: string | null;
  source_block_id: string;
  evidence: ModelEvidence[];
  confidence: AnalyzerV3Confidence;
};

export type PricingModelV3 = {
  status:
    | "public_pricing"
    | "contact_sales"
    | "pricing_unclear"
    | "pricing_scanning"
    | "no_public_pricing"
    | "unavailable";
  page_status: AnalyzerV3Validity;
  model_type:
    | "fixed_plans"
    | "usage_based"
    | "seat_based"
    | "contact_sales"
    | "mixed"
    | "unknown";
  billing_modes: Array<"monthly" | "yearly" | "weekly" | "usage" | "custom">;
  plans: PricingPlanV3[];
  usage_tiers: PricingPlanV3[];
  contact_sales: boolean;
  free_plan: boolean;
  evidence: ModelEvidence[];
  rejected_candidates: AnalyzerEntity[];
  confidence: AnalyzerV3Confidence;
  completeness: number;
  warnings: string[];
};

export type HomepageModelV3 = {
  company_name: string | null;
  headline: string | null;
  subheadline: string | null;
  positioning_statement: string | null;
  target_customer: string | null;
  value_prop: string | null;
  differentiation: string | null;
  evidence: ModelEvidence[];
  confidence: AnalyzerV3Confidence;
  completeness: number;
};

export type CtaModelV3 = {
  primary_cta: string | null;
  secondary_cta: string | null;
  cta_type:
    | "start_trial"
    | "book_demo"
    | "contact_sales"
    | "sign_up"
    | "download"
    | "view_pricing"
    | "get_started"
    | "upgrade_buy"
    | "unknown";
  cta_destination_url: string | null;
  sales_motion: "self_serve" | "sales_led" | "hybrid" | "unknown";
  trial_present: boolean;
  demo_present: boolean;
  evidence: ModelEvidence[];
  confidence: AnalyzerV3Confidence;
};

export type FeatureModelV3 = {
  status: "verified" | "partial" | "unknown";
  feature_groups: string[];
  capabilities: Array<{
    name: string;
    description: string | null;
    evidence: ModelEvidence[];
    confidence: AnalyzerV3Confidence;
  }>;
  differentiators: string[];
  evidence: ModelEvidence[];
  confidence: AnalyzerV3Confidence;
  completeness: number;
};

export type ChangelogModelV3 = {
  status: "verified" | "unknown" | "unavailable";
  entries: Array<{
    title: string;
    date: string | null;
    evidence: ModelEvidence[];
    confidence: AnalyzerV3Confidence;
  }>;
  latest_update: string | null;
  evidence: ModelEvidence[];
  confidence: AnalyzerV3Confidence;
};

export type AvailabilityModelV3 = {
  status:
    | "live"
    | "redirected"
    | "blocked"
    | "missing"
    | "timeout"
    | "unavailable"
    | "unknown";
  http_status: number | null;
  final_url: string | null;
  evidence: ModelEvidence[];
  confidence: AnalyzerV3Confidence;
};

export type BusinessModelV3 = {
  company: string | null;
  category: string | null;
  availability: AvailabilityModelV3;
  availability_model: AvailabilityModelV3;
  homepage: HomepageModelV3;
  homepage_model: HomepageModelV3;
  positioning: HomepageModelV3;
  positioning_model: HomepageModelV3;
  cta: CtaModelV3;
  cta_model: CtaModelV3;
  pricing: PricingModelV3;
  pricing_model: PricingModelV3;
  features: FeatureModelV3;
  feature_model: FeatureModelV3;
  changelog: ChangelogModelV3;
  changelog_model: ChangelogModelV3;
  confidence: AnalyzerV3Confidence;
  completeness: number;
  evidence_summary: ModelEvidence[];
  missing_data: string[];
  warnings: string[];
};

export type AnalyzerV3Result = {
  analyzer_version: "v3";
  input_url: string;
  canonical_url: string;
  fetch_summary: {
    homepage_status: AnalyzerV3Validity;
    pages_attempted: number;
    pages_fetched: number;
    blocked_pages: number;
    missing_pages: number;
  };
  pages: PageBundlePage[];
  blocks: EvidenceBlock[];
  business_model: BusinessModelV3;
  rejected_entities: AnalyzerEntity[];
  validity: AnalyzerV3Validity;
  confidence: AnalyzerV3Confidence;
  completeness: number;
  warnings: string[];
  debug_admin_only: {
    normalized_url: SafeUrlResult;
    page_bundle: PageBundle;
    block_role_counts: Record<string, number>;
    accepted_entities: AnalyzerEntity[];
    rejected_entities: AnalyzerEntity[];
    model_validation: {
      valid: boolean;
      validity: AnalyzerV3Validity;
      reasons: string[];
    };
    comparison_decisions?: unknown[];
  };
};

export type AnalyzerV3FixturePage = {
  url: string;
  requested_page_type: AnalyzerV3PageType;
  html: string;
  status_code?: number;
  content_type?: string;
};

export type AnalyzerV3EvaluationScorecard = {
  fixture: string;
  passed: boolean;
  failures: string[];
  precision: number;
  recall: number;
  false_positive_count: number;
  false_negative_count: number;
  notes: string[];
};
