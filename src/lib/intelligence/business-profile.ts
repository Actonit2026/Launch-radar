import { createHash } from "node:crypto";
import type {
  BusinessModels,
  Confidence,
  ModelEvidence,
  PageIntelligence,
  PricingPlanModel,
} from "@/lib/intelligence/types";

export type BusinessProfile = {
  product_summary: {
    name: string | null;
    category: string | null;
    target_customers: string[];
    use_cases: string[];
    value_props: string[];
    confidence: Confidence;
    evidence: ModelEvidence[];
  };
  monetization: {
    pricing_visibility: BusinessModels["pricing"]["pricing_visibility"];
    pricing_model: BusinessModels["pricing"]["pricing_model"];
    plans: Array<Pick<
      PricingPlanModel,
      "name" | "price" | "currency" | "billing_period" | "billing_type"
    >>;
    billing_patterns: string[];
    contact_sales_detected: boolean;
    confidence: Confidence;
    evidence: ModelEvidence[];
  };
  conversion: {
    funnel_type: BusinessModels["cta"]["funnel_intent"];
    primary_cta: string | null;
    secondary_ctas: string[];
    cta_groups: BusinessModels["cta"]["cta_groups"];
    confidence: Confidence;
    evidence: ModelEvidence[];
  };
  product_capabilities: {
    feature_categories: string[];
    features: Array<{
      name: string;
      description: string | null;
      category: string;
      confidence: Confidence;
      evidence: ModelEvidence[];
    }>;
    integrations: string[];
    workflows: string[];
    proof_points: string[];
    confidence: Confidence;
    evidence: ModelEvidence[];
  };
  momentum: {
    changelog_detected: boolean;
    update_sources: string[];
    recent_updates: string[];
    release_themes: string[];
    confidence: Confidence;
    evidence: ModelEvidence[];
  };
  availability: {
    status: BusinessModels["availability"]["status"];
    previously_seen: boolean;
    last_success_at: string | null;
    current_failure_reason: string | null;
    confidence: Confidence;
  };
  watchlist_suggestions: string[];
  not_detected_reasons: string[];
};

type BusinessProfileCore = Omit<
  BusinessProfile,
  "watchlist_suggestions" | "not_detected_reasons"
>;

export type ProfileHashes = {
  structured_profile_hash: string;
  pricing_model_hash: string;
  positioning_model_hash: string;
  cta_model_hash: string;
  feature_model_hash: string;
  momentum_model_hash: string;
  availability_status_hash: string;
};

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function uniqueEvidence(evidence: ModelEvidence[]) {
  const seen = new Set<string>();

  return evidence.filter((item) => {
    const key = `${item.source_url}:${item.evidence_text}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function confidenceScore(confidence: Confidence) {
  return confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
}

function strongestConfidence(confidences: Confidence[]): Confidence {
  const strongest = Math.max(1, ...confidences.map(confidenceScore));

  return strongest === 3 ? "high" : strongest === 2 ? "medium" : "low";
}

function mostRelevantPage(pages: PageIntelligence[]) {
  return (
    pages.find((page) => page.pageType === "homepage") ??
    pages.find((page) => page.models.positioning.value_props.length) ??
    pages[0]
  );
}

function bestPricingPage(pages: PageIntelligence[]) {
  return (
    pages.find((page) => page.pageType === "pricing" && page.models.pricing.plans.length) ??
    pages.find((page) => page.models.pricing.pricing_visibility !== "unknown") ??
    pages[0]
  );
}

function bestCtaPage(pages: PageIntelligence[]) {
  return (
    pages.find((page) => page.pageType === "homepage" && page.models.cta.primary_cta) ??
    pages.find((page) => page.models.cta.primary_cta) ??
    pages[0]
  );
}

function collectReasons(profile: BusinessProfileCore) {
  const reasons: string[] = [];

  if (
    profile.monetization.pricing_visibility === "unknown" ||
    profile.monetization.pricing_visibility === "hidden"
  ) {
    reasons.push(
      "No public pricing detected after scanning homepage, pricing candidates, plan-like sections, metadata, linked pages, and sitemap links.",
    );
  }

  if (!profile.product_summary.category && !profile.product_summary.value_props.length) {
    reasons.push(
      "Positioning unclear after checking title, metadata, H1/H2 headings, hero copy, semantic sections, and visible text fallback.",
    );
  }

  if (!profile.conversion.primary_cta) {
    reasons.push(
      "No clear CTA detected after checking hero buttons, important links, semantic buttons, and repeated conversion links.",
    );
  }

  if (profile.product_capabilities.features.length < 3) {
    reasons.push(
      "Not enough feature information detected after scanning feature sections, product pages, cards, headings, and visible text fallback.",
    );
  }

  if (!profile.momentum.changelog_detected) {
    reasons.push(
      "No changelog/update page detected after checking update-like URLs, page titles, release language, dates, and sitemap candidates.",
    );
  }

  return reasons;
}

function watchlistSuggestions(profile: BusinessProfileCore) {
  const suggestions = [
    profile.monetization.pricing_visibility === "public" ||
    profile.monetization.pricing_visibility === "partially_public"
      ? "Watch pricing page for plan, price, and packaging changes."
      : "Watch public pages for newly exposed pricing or contact-sales shifts.",
    profile.product_summary.value_props.length
      ? "Watch homepage hero for positioning and target-customer shifts."
      : "Add a product or homepage URL if positioning remains unclear.",
    profile.momentum.changelog_detected
      ? "Watch changelog for release momentum and shipped feature themes."
      : "Add an updates or changelog page if one exists.",
    profile.conversion.primary_cta
      ? "Watch CTA strategy for self-serve, demo, or sales-led shifts."
      : "Watch hero buttons and signup links for CTA strategy changes.",
  ];

  return unique(suggestions);
}

function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildBusinessProfile({
  name,
  pages,
}: {
  name?: string | null;
  pages: PageIntelligence[];
}): BusinessProfile {
  const positioningPage = mostRelevantPage(pages);
  const pricingPage = bestPricingPage(pages);
  const ctaPage = bestCtaPage(pages);
  const featurePages = pages.filter((page) => page.models.features.features.length);
  const momentumPages = pages.filter((page) => page.models.momentum.has_changelog);
  const availabilityPage =
    pages.find((page) => page.models.availability.business_relevance === "high") ??
    pages[0];
  const productSummary = {
    name: name ?? positioningPage?.title ?? null,
    category:
      positioningPage?.models.category.market_category ??
      positioningPage?.models.positioning.category ??
      null,
    target_customers: unique(
      pages.flatMap((page) => page.models.positioning.target_customers),
    ).slice(0, 8),
    use_cases: unique(
      pages.flatMap((page) => page.models.positioning.use_cases),
    ).slice(0, 8),
    value_props: unique(
      pages.flatMap((page) => page.models.positioning.value_props),
    ).slice(0, 8),
    confidence: strongestConfidence(
      pages.map((page) => page.models.positioning.confidence),
    ),
    evidence: uniqueEvidence(
      pages.flatMap((page) => page.models.positioning.evidence),
    ).slice(0, 10),
  };
  const monetization = {
    pricing_visibility: pricingPage?.models.pricing.pricing_visibility ?? "unknown",
    pricing_model: pricingPage?.models.pricing.pricing_model ?? "unknown",
    plans: unique(
      pages.flatMap((page) =>
        page.models.pricing.plans.map(
          (plan) =>
            `${plan.name}|${plan.price ?? ""}|${plan.currency ?? ""}|${plan.billing_period}|${plan.billing_type}`,
        ),
      ),
    )
      .slice(0, 12)
      .map((value) => {
        const [planName, price, currency, billingPeriod, billingType] =
          value.split("|");

        return {
          name: planName,
          price: price ? Number(price) : null,
          currency: (currency || null) as PricingPlanModel["currency"],
          billing_period: billingPeriod as PricingPlanModel["billing_period"],
          billing_type: billingType as PricingPlanModel["billing_type"],
        };
      }),
    billing_patterns: unique(
      pages.flatMap((page) =>
        page.models.pricing.plans.map((plan) => plan.billing_type),
      ),
    ),
    contact_sales_detected: pages.some((page) =>
      page.models.pricing.plans.some(
        (plan) => plan.billing_type === "contact_sales",
      ),
    ),
    confidence: pricingPage?.models.pricing.confidence ?? "low",
    evidence: uniqueEvidence(
      pages.flatMap((page) => page.models.pricing.evidence),
    ).slice(0, 10),
  };
  const conversion = {
    funnel_type: ctaPage?.models.cta.funnel_intent ?? "unclear",
    primary_cta: ctaPage?.models.cta.primary_cta ?? null,
    secondary_ctas: unique(
      pages.flatMap((page) => page.models.cta.secondary_ctas),
    ).slice(0, 8),
    cta_groups: ctaPage?.models.cta.cta_groups ?? [],
    confidence: ctaPage?.models.cta.confidence ?? "low",
    evidence: uniqueEvidence(
      pages.flatMap((page) => page.models.cta.evidence),
    ).slice(0, 10),
  };
  const productCapabilities = {
    feature_categories: unique(
      pages.flatMap((page) => page.models.features.feature_categories),
    ).slice(0, 10),
    features: featurePages
      .flatMap((page) => page.models.features.features)
      .filter((feature, index, features) =>
        features.findIndex((item) => item.name === feature.name) === index,
      )
      .slice(0, 12),
    integrations: unique(
      pages.flatMap((page) => page.models.features.integrations),
    ).slice(0, 8),
    workflows: unique(
      pages.flatMap((page) => page.models.features.workflows),
    ).slice(0, 8),
    proof_points: unique(
      pages.flatMap((page) => page.models.features.proof_points),
    ).slice(0, 8),
    confidence: strongestConfidence(
      pages.map((page) => page.models.features.confidence),
    ),
    evidence: uniqueEvidence(
      pages.flatMap((page) => page.models.features.evidence),
    ).slice(0, 10),
  };
  const momentum = {
    changelog_detected: momentumPages.length > 0,
    update_sources: unique(
      pages.flatMap((page) => page.models.momentum.update_sources),
    ).slice(0, 6),
    recent_updates: unique(
      pages.flatMap((page) => page.models.momentum.recent_updates),
    ).slice(0, 8),
    release_themes: unique(
      pages.flatMap((page) => page.models.momentum.release_themes),
    ).slice(0, 8),
    confidence: strongestConfidence(
      pages.map((page) => page.models.momentum.confidence),
    ),
    evidence: uniqueEvidence(
      pages.flatMap((page) => page.models.momentum.evidence),
    ).slice(0, 10),
  };
  const availability = {
    status: availabilityPage?.models.availability.status ?? "unknown_error",
    previously_seen:
      availabilityPage?.models.availability.previously_seen ?? false,
    last_success_at:
      availabilityPage?.models.availability.last_success_at ?? null,
    current_failure_reason:
      availabilityPage?.models.availability.evidence[0]?.evidence_text ??
      null,
    confidence: availabilityPage?.models.availability.confidence ?? "low",
  };
  const partialProfile: BusinessProfileCore = {
    product_summary: productSummary,
    monetization,
    conversion,
    product_capabilities: productCapabilities,
    momentum,
    availability,
  };

  return {
    ...partialProfile,
    watchlist_suggestions: watchlistSuggestions(partialProfile),
    not_detected_reasons: collectReasons(partialProfile),
  };
}

export function profileHashes(profile: BusinessProfile): ProfileHashes {
  return {
    structured_profile_hash: hashValue(profile),
    pricing_model_hash: hashValue(profile.monetization),
    positioning_model_hash: hashValue(profile.product_summary),
    cta_model_hash: hashValue(profile.conversion),
    feature_model_hash: hashValue(profile.product_capabilities),
    momentum_model_hash: hashValue(profile.momentum),
    availability_status_hash: hashValue(profile.availability),
  };
}

export function compactProfileForSummary(profile: BusinessProfile) {
  return {
    what_it_does:
      profile.product_summary.value_props[0] ??
      profile.product_summary.use_cases[0] ??
      "Positioning unclear from public page content.",
    who_it_serves:
      profile.product_summary.target_customers.length
        ? profile.product_summary.target_customers.join(", ")
        : profile.product_summary.category ?? "Target customer unclear.",
    monetization:
      profile.monetization.pricing_visibility === "public" ||
      profile.monetization.pricing_visibility === "partially_public"
        ? `${profile.monetization.pricing_model} pricing visible`
        : profile.monetization.pricing_visibility === "contact_sales"
          ? "Contact sales detected"
          : "No public pricing detected",
    primary_cta: profile.conversion.primary_cta ?? "No clear CTA detected",
    feature_themes:
      profile.product_capabilities.feature_categories.length
        ? profile.product_capabilities.feature_categories.join(", ")
        : "Feature themes unclear",
    update_presence: profile.momentum.changelog_detected
      ? "Public updates/changelog detected"
      : "No changelog/update page detected",
  };
}
