import type { PageType } from "@/lib/database.types";
import type {
  AvailabilityModel,
  BusinessModels,
  CategoryModel,
  Confidence,
  CtaAnalysis,
  CtaFact,
  CtaModel,
  FeatureAnalysis,
  FeatureModel,
  ModelEvidence,
  MomentumModel,
  PricingAnalysis,
  PricingModel,
  PricingPlanModel,
  PositioningAnalysis,
  PositioningModel,
  StructuredFact,
  TrustModel,
} from "@/lib/intelligence/types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import { parsePricingStructure } from "@/lib/intelligence/pricing-structure";
import { hasReliablePricingPlanLabel } from "@/lib/intelligence/pricing-context";
import {
  analysisBlocks,
  blockText,
  makeFact,
  sentenceCaseKey,
  textLines,
  uniqueBy,
} from "@/lib/intelligence/text";

function scoreForConfidence(confidence: Confidence) {
  return confidence === "high" ? 0.86 : confidence === "medium" ? 0.68 : 0.44;
}

function evidenceFromFact(
  fact: StructuredFact | null | undefined,
  section = "fact",
): ModelEvidence[] {
  if (!fact) {
    return [];
  }

  return [
    {
      source_url: fact.source_url,
      evidence_text: fact.evidence_text,
      section,
      confidence: fact.confidence,
    },
  ];
}

function evidenceFromText({
  sourceUrl,
  text,
  section,
  confidence,
}: {
  sourceUrl: string;
  text: string;
  section: string;
  confidence: Confidence;
}): ModelEvidence {
  return {
    source_url: sourceUrl,
    evidence_text: text.replace(/\s+/g, " ").trim().slice(0, 260),
    section,
    confidence,
  };
}

function strongestConfidence(evidence: ModelEvidence[]): Confidence {
  if (evidence.some((item) => item.confidence === "high")) {
    return "high";
  }

  if (evidence.some((item) => item.confidence === "medium")) {
    return "medium";
  }

  return "low";
}

function strongestConfidenceValue(confidences: Confidence[]): Confidence {
  if (confidences.includes("high")) {
    return "high";
  }

  if (confidences.includes("medium")) {
    return "medium";
  }

  return "low";
}

function normalizedKey(value: string) {
  return sentenceCaseKey(value).replace(/\s+/g, "-") || "unknown";
}

function findLimits(text: string) {
  const matches = [
    ...text.matchAll(
      /\b(?:unlimited|\d{1,6}(?:,\d{3})?\s+(?:users?|seats?|projects?|proposals?|emails?|credits?|responses?|submissions?|sites?|pages?|events?|monitors?|checks?|team members?)(?:\/(?:week|month|year))?)\b/gi,
    ),
  ].map((match) => match[0].replace(/\s+/g, " ").trim());

  return uniqueBy(matches, sentenceCaseKey).slice(0, 6);
}

function detectPlanName(text: string, fallback: string) {
  const explicit = text.match(
    /\b(Free|Starter|Basic|Plus|Pro|Premium|Team|Business|Growth|Scale|Enterprise|Custom|Agency|Creator|Launch)\b/i,
  )?.[1];

  if (explicit) {
    return explicit;
  }

  const heading = text
    .split(/\n+/)
    .map((line) => line.trim())
    .find(
      (line) =>
        line.length >= 2 &&
        line.length <= 42 &&
        !/[.?!]/.test(line) &&
        !/\d{2,}/.test(line),
    );

  return heading ?? fallback;
}

function ctaForEvidence(ctas: CtaAnalysis, evidenceText: string) {
  const sameContext = ctas.ctas.find((cta) =>
    evidenceText.toLowerCase().includes(cta.value.toLowerCase()),
  );

  return sameContext?.value ?? null;
}

function pricingPlanFromPrice({
  fact,
  index,
  ctas,
}: {
  fact: NonNullable<PricingAnalysis["paidPlans"][number]>;
  index: number;
  ctas: CtaAnalysis;
}): PricingPlanModel | null {
  const normalized = fact.normalized_value;
  const evidence = evidenceFromFact(fact, "pricing");
  const name = normalized?.plan ?? detectPlanName(fact.evidence_text, "Public pricing");

  if (!hasReliablePricingPlanLabel(name)) {
    return null;
  }

  const billingType =
    normalized?.unit === "user" || normalized?.unit === "seat"
      ? "seat_based"
      : /\b(?:usage|credit|per\s+(?:email|event|submission|response|proposal|site))\b/i.test(
          fact.evidence_text,
        )
        ? "usage_based"
        : "fixed";

  return {
    id: normalizedKey(`${name}-${fact.value}-${index}`),
    name,
    price: normalized?.amount ?? null,
    currency: normalized?.currency ?? null,
    billing_period: normalized?.period ?? "unknown",
    billing_mode:
      normalized?.period === "month"
        ? "monthly"
        : normalized?.period === "year"
          ? "yearly"
          : normalized?.period === "week"
            ? "weekly"
            : billingType === "usage_based"
              ? "usage"
              : "unknown",
    billing_type: billingType,
    limits: findLimits(fact.evidence_text),
    included_features: [],
    cta: ctaForEvidence(ctas, fact.evidence_text),
    is_enterprise: /enterprise|custom/i.test(name),
    is_custom_price: false,
    evidence,
    confidence: fact.confidence,
    source: fact.source_url,
  };
}

function mergePricingModels(
  structured: PricingModel,
  fallback: PricingModel,
): PricingModel {
  const plans = uniqueBy(
    [...structured.plans, ...fallback.plans],
    (plan) =>
      `${sentenceCaseKey(plan.name)}:${plan.price ?? "custom"}:${plan.currency ?? ""}:${plan.billing_period}:${plan.limits.join("|")}`,
  );
  const enterpriseOptions = uniqueBy(
    [
      ...structured.enterprise_options,
      ...fallback.enterprise_options,
      ...plans
        .filter((plan) => plan.is_enterprise || plan.is_custom_price)
        .map((plan) => ({
          name: plan.name || "Enterprise",
          cta: plan.cta,
          is_custom_price: true as const,
          evidence: plan.evidence,
          confidence: plan.confidence,
          source: plan.source,
        })),
    ],
    (option) => sentenceCaseKey(`${option.name}:${option.cta ?? ""}:${option.source}`),
  );
  const evidence = uniqueBy(
    [...structured.evidence, ...fallback.evidence],
    (item) => `${item.source_url}:${sentenceCaseKey(item.evidence_text)}`,
  );
  const billingModes = uniqueBy(
    [
      ...structured.billing_modes,
      ...fallback.billing_modes,
      ...plans
        .map((plan) => plan.billing_mode)
        .filter((mode): mode is PricingModel["billing_modes"][number] =>
          mode !== "unknown",
        ),
      ...(structured.usage_tiers.length ? ["usage" as const] : []),
    ],
    (mode) => mode,
  );
  const publicPricing =
    plans.some((plan) => plan.price !== null || plan.price === 0) ||
    structured.usage_tiers.some((tier) => tier.price !== null);
  const contactSales = enterpriseOptions.length > 0;
  const visibility: PricingModel["pricing_visibility"] =
    publicPricing && contactSales
      ? "partially_public"
      : publicPricing
        ? "public"
        : contactSales
          ? "contact_sales"
          : structured.pricing_visibility !== "unknown"
            ? structured.pricing_visibility
            : fallback.pricing_visibility;
  const pricingModelType =
    structured.pricing_model_type !== "unknown"
      ? structured.pricing_model_type
      : fallback.pricing_model_type;
  const pricingModel =
    structured.pricing_model !== "unknown"
      ? structured.pricing_model
      : fallback.pricing_model;

  return {
    pricing_visibility: visibility,
    pricing_model: pricingModel,
    pricing_model_type: pricingModelType,
    billing_modes: billingModes,
    plans,
    usage_tiers: structured.usage_tiers,
    enterprise_options: enterpriseOptions,
    evidence,
    confidence: strongestConfidenceValue([
      structured.confidence,
      fallback.confidence,
      strongestConfidence(evidence),
    ]),
    completeness_score: Math.max(
      structured.completeness_score,
      fallback.completeness_score,
    ),
    missing_possible_data: uniqueBy(
      [
        ...structured.missing_possible_data,
        ...fallback.missing_possible_data,
      ],
      sentenceCaseKey,
    ),
  };
}

export function extractPricingModel({
  pricing,
  ctas,
  scrape,
  pageType,
}: {
  pricing: PricingAnalysis;
  ctas: CtaAnalysis;
  scrape: ScrapedPage;
  pageType: PageType;
}): PricingModel {
  const structured = parsePricingStructure({ scrape, pageType });
  const sourceUrl = scrape.finalUrl;
  const plans = pricing.paidPlans
    .map((fact, index) => pricingPlanFromPrice({ fact, index, ctas }))
    .filter((plan): plan is PricingPlanModel => Boolean(plan));

  if (pricing.freePlan) {
    plans.unshift({
      id: "free",
      name: detectPlanName(pricing.freePlan.evidence_text, "Free"),
      price: 0,
      currency: null,
      billing_period: "unknown",
      billing_mode: "unknown",
      billing_type: "fixed",
      limits: findLimits(pricing.freePlan.evidence_text),
      included_features: [],
      cta: ctaForEvidence(ctas, pricing.freePlan.evidence_text),
      is_enterprise: false,
      is_custom_price: false,
      evidence: evidenceFromFact(pricing.freePlan, "pricing"),
      confidence: pricing.freePlan.confidence,
      source: pricing.freePlan.source_url,
    });
  }

  if (pricing.contactSales) {
    plans.push({
      id: "contact-sales",
      name: detectPlanName(pricing.contactSales.evidence_text, "Enterprise"),
      price: null,
      currency: null,
      billing_period: "unknown",
      billing_mode: "custom",
      billing_type: "contact_sales",
      limits: findLimits(pricing.contactSales.evidence_text),
      included_features: [],
      cta: ctaForEvidence(ctas, pricing.contactSales.evidence_text),
      is_enterprise: true,
      is_custom_price: true,
      evidence: evidenceFromFact(pricing.contactSales, "pricing"),
      confidence: pricing.contactSales.confidence,
      source: pricing.contactSales.source_url,
    });
  }

  const pricingBlocks = analysisBlocks(scrape, ["pricing"]).filter(
    (block) => block.type === "pricing",
  );
  const blockEvidence = pricingBlocks.slice(0, 3).map((block) =>
    evidenceFromText({
      sourceUrl,
      text: blockText(block),
      section: block.type,
      confidence: block.confidence >= 0.8 ? "high" : "medium",
    }),
  );
  const evidence = uniqueBy(
    [...plans.flatMap((plan) => plan.evidence), ...blockEvidence],
    (item) => `${item.source_url}:${sentenceCaseKey(item.evidence_text)}`,
  );
  const hasPublic = plans.some((plan) => plan.price !== null || plan.price === 0);
  const hasContact = plans.some((plan) => plan.billing_type === "contact_sales");
  const pricing_visibility: PricingModel["pricing_visibility"] =
    hasPublic && hasContact
      ? "partially_public"
      : hasPublic
        ? "public"
        : hasContact
          ? "contact_sales"
          : !scrape.ok && pageType === "pricing"
            ? "hidden"
            : "unknown";
  const modelTypes = new Set(plans.map((plan) => plan.billing_type));
  const pricing_model: PricingModel["pricing_model"] =
    !plans.length
      ? "unknown"
      : modelTypes.size > 1
        ? "mixed"
        : modelTypes.has("contact_sales")
          ? "contact_sales"
          : modelTypes.has("seat_based")
            ? "seat_based"
            : modelTypes.has("usage_based")
              ? "usage_based"
              : plans.every((plan) => plan.price === 0)
                ? "free"
                : "fixed";

  const fallback: PricingModel = {
    pricing_visibility,
    pricing_model,
    pricing_model_type:
      pricing_model === "fixed" || pricing_model === "free"
        ? "fixed_plans"
        : pricing_model === "usage_based"
          ? "usage_based"
          : pricing_model === "seat_based"
            ? "seat_based"
            : pricing_model === "contact_sales"
              ? "contact_sales"
              : pricing_model === "mixed"
                ? "mixed"
                : "unknown",
    billing_modes: uniqueBy(
      plans
        .map((plan) => plan.billing_mode)
        .filter((mode): mode is PricingModel["billing_modes"][number] =>
          mode !== "unknown",
        ),
      (mode) => mode,
    ),
    plans: uniqueBy(plans, (plan) => `${plan.name}:${plan.price}:${plan.currency}`),
    usage_tiers: [],
    enterprise_options: plans
      .filter((plan) => plan.is_enterprise || plan.is_custom_price)
      .map((plan) => ({
        name: plan.name,
        cta: plan.cta,
        is_custom_price: true,
        evidence: plan.evidence,
        confidence: plan.confidence,
        source: plan.source,
      })),
    evidence,
    confidence: strongestConfidence(evidence),
    completeness_score: hasPublic
      ? plans.length >= 3
        ? 80
        : 60
      : hasContact
        ? 55
        : 0,
    missing_possible_data: [],
  };

  return mergePricingModels(structured, fallback);
}

function pickLines(scrape: ScrapedPage, patterns: RegExp[], limit = 6) {
  return textLines(scrape)
    .filter((line) => patterns.some((pattern) => pattern.test(line)))
    .filter((line) => line.length >= 4 && line.length <= 180)
    .slice(0, limit);
}

function valuesWithEvidence({
  scrape,
  lines,
  section,
}: {
  scrape: ScrapedPage;
  lines: string[];
  section: string;
}) {
  return {
    values: uniqueBy(lines, sentenceCaseKey),
    evidence: uniqueBy(
      lines.map((line) =>
        evidenceFromText({
          sourceUrl: scrape.finalUrl,
          text: line,
          section,
          confidence: "medium",
        }),
      ),
      (item) => item.evidence_text,
    ),
  };
}

export function extractPositioningModel({
  positioning,
  scrape,
}: {
  positioning: PositioningAnalysis;
  scrape: ScrapedPage;
}): PositioningModel {
  const target = valuesWithEvidence({
    scrape,
    lines: [
      ...(positioning.targetCustomer ? [positioning.targetCustomer.value] : []),
      ...pickLines(scrape, [
        /\bfor\s+(?:freelancers|agencies|founders|startups|developers|marketers|sales teams|support teams|creators|teams)\b/i,
        /\b(?:built|made|designed)\s+for\b/i,
      ]),
    ],
    section: "positioning",
  });
  const useCases = valuesWithEvidence({
    scrape,
    lines: [
      ...(positioning.keyUseCase ? [positioning.keyUseCase.value] : []),
      ...pickLines(scrape, [/\b(?:use case|workflow|to help|so you can|track|monitor|generate|send|build)\b/i]),
    ],
    section: "positioning",
  });
  const valueProps = valuesWithEvidence({
    scrape,
    lines: [
      ...(positioning.mainValueProp ? [positioning.mainValueProp.value] : []),
      ...(positioning.homepageHeadline ? [positioning.homepageHeadline.value] : []),
      ...(positioning.subheadline ? [positioning.subheadline.value] : []),
    ],
    section: "positioning",
  });
  const differentiators = valuesWithEvidence({
    scrape,
    lines: pickLines(scrape, [/\b(?:without|privacy-first|fastest|simple|deterministic|evidence-backed|no-code|AI-powered|open-source)\b/i]),
    section: "positioning",
  });
  const painPoints = valuesWithEvidence({
    scrape,
    lines: pickLines(scrape, [/\b(?:avoid|stop|instead of|no more|without|pain|manual|noisy|messy|slow)\b/i]),
    section: "positioning",
  });
  const outcomes = valuesWithEvidence({
    scrape,
    lines: pickLines(scrape, [/\b(?:save time|increase|reduce|improve|convert|grow|ship|launch|faster|better)\b/i]),
    section: "positioning",
  });
  const evidence = uniqueBy(
    [
      ...target.evidence,
      ...useCases.evidence,
      ...valueProps.evidence,
      ...differentiators.evidence,
      ...painPoints.evidence,
      ...outcomes.evidence,
      ...positioning.facts.flatMap((fact) => evidenceFromFact(fact, "positioning")),
    ],
    (item) => `${item.source_url}:${sentenceCaseKey(item.evidence_text)}`,
  );

  return {
    category: positioning.productCategory?.value ?? null,
    target_customers: target.values.slice(0, 6),
    use_cases: useCases.values.slice(0, 6),
    value_props: valueProps.values.slice(0, 6),
    differentiators: differentiators.values.slice(0, 5),
    pain_points: painPoints.values.slice(0, 5),
    outcomes_promised: outcomes.values.slice(0, 5),
    evidence,
    confidence: strongestConfidence(evidence),
  };
}

function ctaGroup(cta: CtaFact): CtaModel["cta_groups"][number]["group"] {
  switch (cta.normalized_value?.intent) {
    case "start_trial":
    case "sign_up":
    case "get_started":
      return "trial/signup";
    case "book_demo":
    case "contact_sales":
      return "demo/sales";
    case "view_pricing":
    case "upgrade_buy":
      return "upgrade/buy";
    case "download":
      return "download";
    default:
      return /log\s?in|account|dashboard/i.test(cta.value)
        ? "login/account"
        : "unknown";
  }
}

export function extractCTAModel(ctas: CtaAnalysis): CtaModel {
  const conversionCtas = ctas.ctas.filter(
    (cta) => ctaGroup(cta) !== "login/account",
  );
  const grouped = new Map<CtaModel["cta_groups"][number]["group"], string[]>();

  ctas.ctas.forEach((cta) => {
    const group = ctaGroup(cta);
    grouped.set(group, uniqueBy([...(grouped.get(group) ?? []), cta.value], sentenceCaseKey));
  });

  const hasSelfServe = conversionCtas.some((cta) =>
    ["trial/signup", "upgrade/buy", "download"].includes(ctaGroup(cta)),
  );
  const hasSales = conversionCtas.some((cta) => ctaGroup(cta) === "demo/sales");
  const evidence = conversionCtas.flatMap((cta) => evidenceFromFact(cta, "cta"));

  return {
    primary_cta: conversionCtas[0]?.value ?? null,
    secondary_ctas: conversionCtas.slice(1, 5).map((cta) => cta.value),
    cta_groups: Array.from(grouped.entries()).map(([group, values]) => ({
      group,
      ctas: values,
    })),
    funnel_intent: hasSelfServe && hasSales
      ? "hybrid"
      : hasSelfServe
        ? "self_serve"
        : hasSales
          ? "sales_led"
          : "unclear",
    evidence,
    confidence: strongestConfidence(evidence),
  };
}

function featureCategory(value: string) {
  const text = value.toLowerCase();

  if (/ai|generation|assistant|copilot|personaliz/.test(text)) return "AI";
  if (/analytics|report|dashboard|metric/.test(text)) return "analytics";
  if (/collaboration|team|permission|role/.test(text)) return "collaboration";
  if (/integration|api|webhook|sync/.test(text)) return "integrations";
  if (/alert|monitor|tracking|status|uptime/.test(text)) return "monitoring";
  if (/payment|billing|checkout|subscription/.test(text)) return "payments";
  if (/template|content|editor|proposal|email/.test(text)) return "content generation";
  if (/automat|workflow|runbook/.test(text)) return "automation";

  return "product";
}

export function extractFeatureModel(features: FeatureAnalysis): FeatureModel {
  const modeledFeatures = features.features.map((feature) => {
    const category = featureCategory(feature.value);

    return {
      name: feature.normalized_value?.name ?? feature.value,
      description: feature.normalized_value?.description ?? null,
      category,
      evidence: evidenceFromFact(feature, "features"),
      confidence: feature.confidence,
    };
  });
  const evidence = modeledFeatures.flatMap((feature) => feature.evidence);

  return {
    feature_categories: uniqueBy(modeledFeatures.map((feature) => feature.category), sentenceCaseKey),
    features: modeledFeatures,
    integrations: modeledFeatures
      .filter((feature) => feature.category === "integrations")
      .map((feature) => feature.name),
    workflows: modeledFeatures
      .filter((feature) => /workflow|automation|runbook/i.test(feature.name))
      .map((feature) => feature.name),
    proof_points: modeledFeatures
      .filter((feature) => /security|sso|soc|compliance|uptime/i.test(feature.name))
      .map((feature) => feature.name),
    evidence,
    confidence: strongestConfidence(evidence),
  };
}

export function extractMomentumModel({
  scrape,
  changelog,
}: {
  scrape: ScrapedPage;
  changelog: import("@/lib/intelligence/types").ChangelogAnalysis;
}): MomentumModel {
  const recentUpdates = changelog.recentUpdateTitles.map((fact) => fact.value);
  const evidence = [
    ...evidenceFromFact(changelog.changelogDetected, "changelog"),
    ...evidenceFromFact(changelog.lastVisibleUpdateDate, "changelog"),
    ...changelog.recentUpdateTitles.flatMap((fact) =>
      evidenceFromFact(fact, "changelog"),
    ),
  ];
  const releaseThemes = uniqueBy(
    recentUpdates
      .join("\n")
      .match(/\b(?:pricing|dashboard|api|integration|security|billing|automation|alerts|reports|analytics)\b/gi) ??
      [],
    sentenceCaseKey,
  );

  return {
    has_changelog: Boolean(changelog.changelogDetected),
    update_sources: changelog.changelogUrl ? [changelog.changelogUrl] : [],
    recent_updates: recentUpdates,
    update_frequency_estimate:
      recentUpdates.length >= 3
        ? "active"
        : recentUpdates.length
          ? "occasional"
          : "unknown",
    last_visible_update: changelog.lastVisibleUpdateDate?.value ?? null,
    release_themes: releaseThemes,
    evidence: evidence.length
      ? evidence
      : scrape.pageModel?.changelogBlocks.slice(0, 1).map((block) =>
          evidenceFromText({
            sourceUrl: scrape.finalUrl,
            text: blockText(block),
            section: "changelog",
            confidence: "low",
          }),
        ) ?? [],
    confidence: changelog.confidence,
  };
}

export function classifyAvailabilityStatus(scrape: ScrapedPage): AvailabilityModel["status"] {
  if (scrape.ok) {
    return scrape.requestedUrl !== scrape.finalUrl ? "redirected" : "live";
  }

  if (scrape.status === 404 || scrape.status === 410) return "not_found";
  if (scrape.status === 401 || scrape.status === 403) return "blocked";
  if (scrape.status && scrape.status >= 500) return "server_error";

  const message = scrape.error ?? "";
  if (/timeout|abort/i.test(message)) return "timeout";
  if (/dns|enotfound|getaddrinfo/i.test(message)) return "dns_error";
  if (/ssl|certificate|tls/i.test(message)) return "ssl_error";
  if (/robot|blocked|forbidden|403/i.test(message)) return "blocked";

  return message ? "inaccessible" : "unknown_error";
}

export function extractAvailabilityModel({
  scrape,
  pageType,
  previouslySeen = false,
  lastSuccessAt = null,
}: {
  scrape: ScrapedPage;
  pageType: PageType;
  previouslySeen?: boolean;
  lastSuccessAt?: string | null;
}): AvailabilityModel {
  const status = classifyAvailabilityStatus(scrape);
  const confidence: Confidence =
    scrape.status !== null || scrape.error ? "high" : scrape.ok ? "medium" : "low";
  const businessRelevance =
    pageType === "pricing"
      ? "high"
      : pageType === "changelog" || pageType === "features"
        ? "medium"
        : "low";

  return {
    status,
    http_status: scrape.status,
    final_url: scrape.finalUrl,
    error_type: scrape.errorType ?? (scrape.error ? status : null),
    previously_seen: previouslySeen,
    last_success_at: lastSuccessAt,
    current_failure_at: scrape.ok ? null : new Date().toISOString(),
    business_relevance: businessRelevance,
    evidence: [
      evidenceFromText({
        sourceUrl: scrape.finalUrl,
        text: scrape.ok
          ? `Fetch succeeded${scrape.status ? ` with HTTP ${scrape.status}` : ""}.`
          : scrape.error ?? `Fetch failed${scrape.status ? ` with HTTP ${scrape.status}` : ""}.`,
        section: "availability",
        confidence,
      }),
    ],
    confidence,
  };
}

export function extractTrustModel(scrape: ScrapedPage): TrustModel {
  const lines = textLines(scrape);
  const userCounts = pickLines(scrape, [
    /\b\d{2,6}(?:,\d{3})?\s+(?:customers|users|teams|companies|creators|agencies)\b/i,
  ]);
  const reviewMentions = pickLines(scrape, [/\b(?:reviews?|rated|stars?|g2|capterra|testimonial)\b/i]);
  const securityMentions = pickLines(scrape, [/\b(?:security|secure|encryption|privacy|sso|audit)\b/i]);
  const complianceMentions = pickLines(scrape, [/\b(?:soc\s?2|gdpr|hipaa|iso\s?27001|compliance|dpa)\b/i]);
  const evidenceLines = [
    ...userCounts,
    ...reviewMentions,
    ...securityMentions,
    ...complianceMentions,
  ];
  const evidence = evidenceLines.map((line) =>
    evidenceFromText({
      sourceUrl: scrape.finalUrl,
      text: line,
      section: "trust",
      confidence: "medium",
    }),
  );

  return {
    testimonials_detected: lines.some((line) => /testimonial|customer story|what customers say/i.test(line)),
    customer_logos_detected: lines.some((line) => /trusted by|used by|customers include/i.test(line)),
    user_counts: uniqueBy(userCounts, sentenceCaseKey),
    review_mentions: uniqueBy(reviewMentions, sentenceCaseKey),
    security_mentions: uniqueBy(securityMentions, sentenceCaseKey),
    compliance_mentions: uniqueBy(complianceMentions, sentenceCaseKey),
    evidence,
    confidence: evidence.length ? "medium" : "low",
  };
}

export function extractCategoryModel({
  scrape,
  positioning,
  features,
}: {
  scrape: ScrapedPage;
  positioning: PositioningModel;
  features: FeatureModel;
}): CategoryModel {
  const text = textLines(scrape).join("\n").toLowerCase();
  const categories: Array<[string, RegExp]> = [
    ["proposal software", /proposal|freelance|client brief/],
    ["analytics", /analytics|metrics|web analytics|dashboard/],
    ["website builder", /website builder|landing page|no-code site/],
    ["monitoring", /monitoring|alerts|uptime|status page|competitor/],
    ["email marketing", /email|newsletter|transactional/],
    ["customer support", /support|helpdesk|chat|inbox/],
    ["forms", /forms|survey|submissions/],
    ["payments", /payments|checkout|billing|subscription/],
    ["scheduling", /calendar|scheduling|book meetings/],
  ];
  const matched = categories.filter(([, pattern]) => pattern.test(text));
  const primary = positioning.category ?? matched[0]?.[0] ?? null;
  const evidence = primary
    ? [
        evidenceFromText({
          sourceUrl: scrape.finalUrl,
          text: positioning.value_props[0] ?? scrape.title,
          section: "category",
          confidence: "medium",
        }),
      ]
    : [];

  return {
    market_category: primary,
    adjacent_categories: matched.slice(1, 4).map(([category]) => category),
    likely_audience: positioning.target_customers,
    business_model_signals: uniqueBy(
      [
        ...features.feature_categories,
        ...(text.includes("contact sales") ? ["sales-led"] : []),
        ...(text.includes("free") ? ["free tier"] : []),
      ],
      sentenceCaseKey,
    ),
    confidence: primary ? "medium" : "low",
    evidence,
  };
}

export function buildBusinessModels({
  scrape,
  pageType,
  pricing,
  positioning,
  ctas,
  features,
  changelog,
}: {
  scrape: ScrapedPage;
  pageType: PageType;
  pricing: PricingAnalysis;
  positioning: PositioningAnalysis;
  ctas: CtaAnalysis;
  features: FeatureAnalysis;
  changelog: import("@/lib/intelligence/types").ChangelogAnalysis;
}): BusinessModels {
  const pricingModel = extractPricingModel({ pricing, ctas, scrape, pageType });
  const positioningModel = extractPositioningModel({ positioning, scrape });
  const ctaModel = extractCTAModel(ctas);
  const featureModel = extractFeatureModel(features);
  const momentumModel = extractMomentumModel({ scrape, changelog });
  const availabilityModel = extractAvailabilityModel({ scrape, pageType });
  const trustModel = extractTrustModel(scrape);
  const categoryModel = extractCategoryModel({
    scrape,
    positioning: positioningModel,
    features: featureModel,
  });

  return {
    pricing: pricingModel,
    positioning: positioningModel,
    cta: ctaModel,
    features: featureModel,
    momentum: momentumModel,
    availability: availabilityModel,
    trust: trustModel,
    category: categoryModel,
  };
}

function modelFact({
  field,
  value,
  sourceUrl,
  evidence,
  confidence,
}: {
  field: string;
  value: string;
  sourceUrl: string;
  evidence: ModelEvidence | undefined;
  confidence: Confidence;
}) {
  if (!evidence?.evidence_text) {
    return null;
  }

  return makeFact({
    field,
    value,
    confidence,
    confidenceScore: scoreForConfidence(confidence),
    sourceUrl,
    evidenceText: evidence.evidence_text,
    extractionMethod: "deterministic_structure",
  });
}

export function businessModelFacts(models: BusinessModels): StructuredFact[] {
  const facts: Array<StructuredFact | null> = [];
  const pricingEvidence = models.pricing.evidence[0];
  const ctaEvidence = models.cta.evidence[0];
  const categoryEvidence = models.category.evidence[0];

  facts.push(
    modelFact({
      field: "pricing_visibility",
      value: models.pricing.pricing_visibility,
      sourceUrl: pricingEvidence?.source_url ?? "",
      evidence: pricingEvidence,
      confidence: models.pricing.confidence,
    }),
    modelFact({
      field: "pricing_model",
      value: models.pricing.pricing_model,
      sourceUrl: pricingEvidence?.source_url ?? "",
      evidence: pricingEvidence,
      confidence: models.pricing.confidence,
    }),
    modelFact({
      field: "pricing_model_type",
      value: models.pricing.pricing_model_type,
      sourceUrl: pricingEvidence?.source_url ?? "",
      evidence: pricingEvidence,
      confidence: models.pricing.confidence,
    }),
    modelFact({
      field: "pricing_completeness",
      value: String(models.pricing.completeness_score),
      sourceUrl: pricingEvidence?.source_url ?? "",
      evidence: pricingEvidence,
      confidence: models.pricing.confidence,
    }),
    modelFact({
      field: "cta_funnel_intent",
      value: models.cta.funnel_intent,
      sourceUrl: ctaEvidence?.source_url ?? "",
      evidence: ctaEvidence,
      confidence: models.cta.confidence,
    }),
    modelFact({
      field: "market_category",
      value: models.category.market_category ?? "unknown",
      sourceUrl: categoryEvidence?.source_url ?? "",
      evidence: categoryEvidence,
      confidence: models.category.confidence,
    }),
  );

  for (const plan of models.pricing.plans.slice(0, 8)) {
    const priceLabel =
      plan.price === null
        ? plan.is_custom_price
          ? "custom"
          : plan.billing_type
        : `${plan.currency ?? ""} ${plan.price}`;
    const details = [
      plan.billing_period !== "unknown" ? `per ${plan.billing_period}` : null,
      plan.billing_mode !== "unknown" ? plan.billing_mode : null,
      plan.limits[0],
    ]
      .filter(Boolean)
      .join(", ");

    facts.push(
      modelFact({
        field: "pricing_plan",
        value: details
          ? `${plan.name}: ${priceLabel} (${details})`
          : `${plan.name}: ${priceLabel}`,
        sourceUrl: plan.source,
        evidence: plan.evidence[0],
        confidence: plan.confidence,
      }),
    );
  }

  for (const tier of models.pricing.usage_tiers.slice(0, 20)) {
    const priceLabel =
      tier.price === null
        ? "custom"
        : `${tier.currency ?? ""} ${tier.price}`;
    const period =
      tier.billing_period !== "unknown" ? ` per ${tier.billing_period}` : "";

    facts.push(
      modelFact({
        field: "usage_tier",
        value: `${tier.limit ?? tier.label}: ${priceLabel}${period}`,
        sourceUrl: tier.source,
        evidence: tier.evidence[0],
        confidence: tier.confidence,
      }),
    );
  }

  for (const mode of models.pricing.billing_modes) {
    facts.push(
      modelFact({
        field: "billing_mode",
        value: mode,
        sourceUrl: pricingEvidence?.source_url ?? "",
        evidence: pricingEvidence,
        confidence: models.pricing.confidence,
      }),
    );
  }

  for (const missing of models.pricing.missing_possible_data) {
    facts.push(
      modelFact({
        field: "pricing_missing_data",
        value: missing,
        sourceUrl: pricingEvidence?.source_url ?? "",
        evidence: pricingEvidence,
        confidence: "medium",
      }),
    );
  }

  for (const value of models.positioning.target_customers.slice(0, 4)) {
    facts.push(
      modelFact({
        field: "target_customer_model",
        value,
        sourceUrl: models.positioning.evidence[0]?.source_url ?? "",
        evidence: models.positioning.evidence.find((item) =>
          item.evidence_text.includes(value),
        ) ?? models.positioning.evidence[0],
        confidence: models.positioning.confidence,
      }),
    );
  }

  for (const category of models.features.feature_categories.slice(0, 6)) {
    facts.push(
      modelFact({
        field: "feature_category",
        value: category,
        sourceUrl: models.features.evidence[0]?.source_url ?? "",
        evidence: models.features.evidence[0],
        confidence: models.features.confidence,
      }),
    );
  }

  return facts.filter((fact): fact is StructuredFact => Boolean(fact));
}
