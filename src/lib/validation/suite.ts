import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { discoverCompetitorPages } from "@/lib/crawler/discovery";
import { analyzePageIntelligence } from "@/lib/intelligence/analyze";
import {
  buildBusinessProfile,
  profileHashes,
  type BusinessProfile,
  type ProfileHashes,
} from "@/lib/intelligence/business-profile";
import type { PageIntelligence, StructuredFact } from "@/lib/intelligence/types";
import {
  buildProductRecommendations,
  type ProductRecommendationDraft,
} from "@/lib/product-recommendations";
import type { Database, Json } from "@/lib/database.types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseCompetitorUrl } from "@/lib/urls";
import {
  validationSaasExamples,
  type ValidationSaasExample,
} from "@/lib/validation/validation-saas-examples";

type Supabase = SupabaseClient<Database>;

export type ValidationSignalStatus =
  | "found"
  | "not_public"
  | "contact_sales"
  | "unclear"
  | "blocked"
  | "failed";

export type ValidationCaseReport = {
  product_name: string;
  url: string;
  analyzer_status: ValidationSignalStatus;
  pricing_status: ValidationSignalStatus;
  positioning_status: ValidationSignalStatus;
  cta_status: ValidationSignalStatus;
  feature_status: ValidationSignalStatus;
  competitor_count: number;
  recommendations_status: string;
  day_one_baseline_status: "created" | "partial" | "failed";
  baseline_timestamp: string | null;
  baseline_hashes: ProfileHashes | null;
  follow_up_comparison?: {
    previous_profile_hash: string | null;
    current_profile_hash: string | null;
    profile_changed: boolean | null;
    changed_models: string[];
    status:
      | "new_baseline"
      | "no_meaningful_change"
      | "model_changed"
      | "unavailable";
  };
  facts_detected: number;
  watchlist_suggestions: string[];
  failures: string[];
  warnings: string[];
  ship_ready_for_this_case: boolean;
};

export type ValidationSuiteReport = {
  run_type:
    | "full_suite"
    | "single_url"
    | "scenario"
    | "follow_up"
    | "homepage_examples";
  started_at: string;
  completed_at: string;
  ai_enabled: false;
  cases: ValidationCaseReport[];
  pass_count: number;
  fail_count: number;
  ship_ready: boolean;
};

type AnalyzeSaasResult = {
  pages: PageIntelligence[];
  profile: BusinessProfile | null;
  facts: StructuredFact[];
  hashes: ProfileHashes | null;
  warnings: string[];
  failures: string[];
};

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeUrl(value: string) {
  return parseCompetitorUrl(value).baseUrl;
}

function facts(pages: PageIntelligence[]) {
  return pages.flatMap((page) => page.facts);
}

function pricingStatus(profile: BusinessProfile | null): ValidationSignalStatus {
  if (!profile) {
    return "failed";
  }

  if (profile.availability.status === "blocked") {
    return "blocked";
  }

  if (profile.monetization.pricing_visibility === "contact_sales") {
    return "contact_sales";
  }

  if (
    profile.monetization.pricing_visibility === "public" ||
    profile.monetization.pricing_visibility === "partially_public"
  ) {
    return "found";
  }

  if (profile.monetization.pricing_visibility === "hidden") {
    return "not_public";
  }

  return "unclear";
}

function positioningStatus(
  profile: BusinessProfile | null,
): ValidationSignalStatus {
  if (!profile) {
    return "failed";
  }

  return profile.product_summary.value_props.length ||
    profile.product_summary.category ||
    profile.product_summary.target_customers.length
    ? "found"
    : "unclear";
}

function ctaStatus(profile: BusinessProfile | null): ValidationSignalStatus {
  if (!profile) {
    return "failed";
  }

  return profile.conversion.primary_cta ? "found" : "unclear";
}

function featureStatus(profile: BusinessProfile | null): ValidationSignalStatus {
  if (!profile) {
    return "failed";
  }

  return profile.product_capabilities.features.length >= 3 ||
    profile.product_capabilities.feature_categories.length >= 2
    ? "found"
    : "unclear";
}

function signalFailure({
  label,
  required,
  status,
}: {
  label: string;
  required: boolean;
  status: ValidationSignalStatus;
}) {
  if (!required) {
    return null;
  }

  return status === "found" || status === "contact_sales" || status === "not_public"
    ? null
    : `${label} required but status was ${status}.`;
}

function reportShipReady(passCount: number, caseCount: number) {
  return caseCount >= 10 ? passCount >= 8 : passCount === caseCount;
}

async function analyzeSaas(
  name: string,
  url: string,
): Promise<AnalyzeSaasResult> {
  try {
    const normalizedUrl = normalizeUrl(url);
    const discovered = await discoverCompetitorPages(normalizedUrl);
    const pages = discovered
      .filter((page) => page.scrape.ok && page.scrape.rawText)
      .map((page) =>
        analyzePageIntelligence({
          pageType: page.pageType,
          scrape: page.scrape,
        }),
      );

    if (!pages.length) {
      return {
        pages: [],
        profile: null,
        facts: [],
        hashes: null,
        warnings: [],
        failures: ["No useful public pages found."],
      };
    }

    const profile = buildBusinessProfile({ name, pages });

    return {
      pages,
      profile,
      facts: facts(pages),
      hashes: profileHashes(profile),
      warnings: [
        ...new Set([
          ...pages.flatMap((page) => page.warnings),
          ...profile.not_detected_reasons,
        ]),
      ],
      failures: [],
    };
  } catch (error) {
    return {
      pages: [],
      profile: null,
      facts: [],
      hashes: null,
      warnings: [],
      failures: [
        error instanceof Error ? error.message : "Analysis failed unexpectedly.",
      ],
    };
  }
}

function recommendationsStatus(recommendations: ProductRecommendationDraft[]) {
  return recommendations.length
    ? `${recommendations.length} evidence-backed recommendation${
        recommendations.length === 1 ? "" : "s"
      }`
    : "No strong recommendation yet";
}

async function runCase(
  example: ValidationSaasExample,
): Promise<ValidationCaseReport> {
  const baselineTimestamp = new Date().toISOString();
  const primary = await analyzeSaas(example.name, example.url);
  const competitorReports = await Promise.all(
    example.competitor_urls.slice(0, 2).map((url, index) =>
      analyzeSaas(`${example.name} competitor ${index + 1}`, url),
    ),
  );
  const competitorSnapshots = competitorReports
    .filter((report) => report.facts.length)
    .map((report, index) => ({
      competitorName: new URL(example.competitor_urls[index]).hostname,
      facts: report.facts,
    }));
  const recommendations = buildProductRecommendations({
    productFacts: primary.facts,
    competitorSnapshots,
  });
  const pricing = pricingStatus(primary.profile);
  const positioning = positioningStatus(primary.profile);
  const cta = ctaStatus(primary.profile);
  const features = featureStatus(primary.profile);
  const failures = [
    ...primary.failures,
    ...competitorReports.flatMap((report, index) =>
      report.failures.map(
        (failure) => `Competitor ${index + 1}: ${failure}`,
      ),
    ),
    signalFailure({
      label: "Pricing",
      required: example.expected_signals.pricing_required,
      status: pricing,
    }),
    signalFailure({
      label: "Positioning",
      required: example.expected_signals.positioning_required,
      status: positioning,
    }),
    signalFailure({
      label: "CTA",
      required: example.expected_signals.cta_required,
      status: cta,
    }),
    signalFailure({
      label: "Features",
      required: example.expected_signals.features_required,
      status: features,
    }),
    primary.facts.length >= 3
      ? null
      : `Expected at least 3 useful facts, found ${primary.facts.length}.`,
    competitorReports.filter((report) => report.profile).length >= 2
      ? null
      : "Two competitor baselines were not created.",
  ].filter((failure): failure is string => Boolean(failure));
  const warnings = [
    ...primary.warnings,
    ...competitorReports.flatMap((report, index) =>
      report.warnings.map((warning) => `Competitor ${index + 1}: ${warning}`),
    ),
  ].slice(0, 12);
  const baselineCreated = primary.profile && primary.hashes;

  return {
    product_name: example.name,
    url: example.url,
    analyzer_status: primary.profile ? "found" : "failed",
    pricing_status: pricing,
    positioning_status: positioning,
    cta_status: cta,
    feature_status: features,
    competitor_count: competitorReports.filter((report) => report.profile)
      .length,
    recommendations_status: recommendationsStatus(recommendations),
    day_one_baseline_status: baselineCreated
      ? failures.length
        ? "partial"
        : "created"
      : "failed",
    baseline_timestamp: baselineCreated ? baselineTimestamp : null,
    baseline_hashes: primary.hashes,
    facts_detected: primary.facts.length,
    watchlist_suggestions: primary.profile?.watchlist_suggestions ?? [],
    failures,
    warnings,
    ship_ready_for_this_case: failures.length === 0,
  };
}

export async function runValidationSuite(options?: {
  names?: string[];
}): Promise<ValidationSuiteReport> {
  const startedAt = new Date().toISOString();
  const selected = options?.names?.length
    ? validationSaasExamples.filter((example) =>
        options.names?.includes(example.name),
      )
    : validationSaasExamples.slice(0, 10);
  const cases: ValidationCaseReport[] = [];

  for (const example of selected) {
    cases.push(await runCase(example));
  }

  const completedAt = new Date().toISOString();
  const passCount = cases.filter((item) => item.ship_ready_for_this_case).length;

  return {
    run_type: "full_suite",
    started_at: startedAt,
    completed_at: completedAt,
    ai_enabled: false,
    cases,
    pass_count: passCount,
    fail_count: cases.length - passCount,
    ship_ready: reportShipReady(passCount, cases.length),
  };
}

function compareProfileHashes(
  previous: ProfileHashes | null | undefined,
  current: ProfileHashes | null,
): ValidationCaseReport["follow_up_comparison"] {
  if (!current) {
    return {
      previous_profile_hash: previous?.structured_profile_hash ?? null,
      current_profile_hash: null,
      profile_changed: null,
      changed_models: [],
      status: "unavailable",
    };
  }

  if (!previous) {
    return {
      previous_profile_hash: null,
      current_profile_hash: current.structured_profile_hash,
      profile_changed: null,
      changed_models: [],
      status: "new_baseline",
    };
  }

  const changedModels = [
    ["pricing", previous.pricing_model_hash, current.pricing_model_hash],
    [
      "positioning",
      previous.positioning_model_hash,
      current.positioning_model_hash,
    ],
    ["cta", previous.cta_model_hash, current.cta_model_hash],
    ["features", previous.feature_model_hash, current.feature_model_hash],
    ["momentum", previous.momentum_model_hash, current.momentum_model_hash],
    [
      "availability",
      previous.availability_status_hash,
      current.availability_status_hash,
    ],
  ]
    .filter(([, oldHash, newHash]) => oldHash !== newHash)
    .map(([label]) => label);

  return {
    previous_profile_hash: previous.structured_profile_hash,
    current_profile_hash: current.structured_profile_hash,
    profile_changed: changedModels.length > 0,
    changed_models: changedModels,
    status: changedModels.length ? "model_changed" : "no_meaningful_change",
  };
}

export async function runFollowUpValidationSuite(
  previousReport?: ValidationSuiteReport | null,
  options?: { names?: string[] },
) {
  const report = await runValidationSuite(options);
  const previousCases = new Map(
    previousReport?.cases.map((item) => [item.product_name, item]) ?? [],
  );
  const cases = report.cases.map((item) => ({
    ...item,
    follow_up_comparison: compareProfileHashes(
      previousCases.get(item.product_name)?.baseline_hashes,
      item.baseline_hashes,
    ),
  }));
  const passCount = cases.filter((item) => item.ship_ready_for_this_case).length;

  return {
    ...report,
    run_type: "follow_up" as const,
    cases,
    pass_count: passCount,
    fail_count: cases.length - passCount,
    ship_ready: reportShipReady(passCount, cases.length),
  };
}

export async function runSingleUrlValidation(url: string) {
  const normalized = normalizeUrl(url);
  const startedAt = new Date().toISOString();
  const report = await runCase({
    name: new URL(normalized).hostname.replace(/^www\./, ""),
    url: normalized,
    category: "single-url",
    competitor_urls: validationSaasExamples[0].competitor_urls,
    expected_signals: {
      pricing_required: false,
      positioning_required: true,
      cta_required: true,
      features_required: false,
    },
  });
  const completedAt = new Date().toISOString();

  return {
    run_type: "single_url" as const,
    started_at: startedAt,
    completed_at: completedAt,
    ai_enabled: false as const,
    cases: [report],
    pass_count: report.ship_ready_for_this_case ? 1 : 0,
    fail_count: report.ship_ready_for_this_case ? 0 : 1,
    ship_ready: report.ship_ready_for_this_case,
  };
}

export async function runScenarioValidation({
  productUrl,
  competitorUrls,
}: {
  productUrl: string;
  competitorUrls: string[];
}) {
  const normalizedProduct = normalizeUrl(productUrl);
  const report = await runCase({
    name: new URL(normalizedProduct).hostname.replace(/^www\./, ""),
    url: normalizedProduct,
    category: "manual-scenario",
    competitor_urls: competitorUrls.slice(0, 2).map(normalizeUrl),
    expected_signals: {
      pricing_required: false,
      positioning_required: true,
      cta_required: true,
      features_required: false,
    },
  });
  const now = new Date().toISOString();

  return {
    run_type: "scenario" as const,
    started_at: now,
    completed_at: new Date().toISOString(),
    ai_enabled: false as const,
    cases: [report],
    pass_count: report.ship_ready_for_this_case ? 1 : 0,
    fail_count: report.ship_ready_for_this_case ? 0 : 1,
    ship_ready: report.ship_ready_for_this_case,
  };
}

export function validationReportHash(report: ValidationSuiteReport) {
  return hashValue(report);
}

export async function saveValidationRun({
  supabase = getSupabaseAdminClient(),
  userId,
  report,
}: {
  supabase?: Supabase;
  userId: string;
  report: ValidationSuiteReport;
}) {
  const failures = report.cases.flatMap((item) =>
    item.failures.map((failure) => `${item.product_name}: ${failure}`),
  );
  const { data, error } = await supabase
    .from("validation_runs")
    .insert({
      run_type: report.run_type,
      status:
        report.fail_count === 0
          ? "passed"
          : report.pass_count > 0
          ? "partial"
          : "failed",
      case_count: report.cases.length,
      passed_count: report.pass_count,
      report_json: toJson(report),
      failures,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getValidationRuns(limit = 10) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("validation_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getValidationRun(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("validation_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
