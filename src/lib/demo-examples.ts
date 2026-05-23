import { demoCompetitorPool, type DemoCompetitor } from "@/lib/demo-competitors";
import { discoverCompetitorPages } from "@/lib/crawler/discovery";
import { analyzePageIntelligence } from "@/lib/intelligence/analyze";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  Confidence,
  PageIntelligence,
  StructuredFact,
} from "@/lib/intelligence/types";
import type { DemoExampleResult, Json } from "@/lib/database.types";

export const DEMO_ANALYZER_VERSION = "deterministic-v4";

export type DemoExample = {
  name: string;
  site_url: string;
  source_url: string;
  category: string;
  positioning: string;
  pricing: string;
  cta: string;
  feature_signal: string;
  evidence_text: string;
  confidence: Confidence;
  last_verified_at: string | null;
  analyzer_version: string;
  status: "success" | "partial" | "failed";
};

export type DemoExamplesCache = {
  updated_at: string | null;
  next_refresh_at: string | null;
  refresh_status: "ready" | "pending" | "unavailable";
  examples: DemoExample[];
};

export type DemoRefreshResult = {
  attempted: number;
  saved: number;
  failed: number;
  examples: DemoExample[];
  errors: string[];
  rotationWeek: number;
};

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function demoRotationWeek(date = new Date()) {
  const utcDay = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );

  return Math.floor(utcDay / (7 * 24 * 60 * 60 * 1000));
}

function nextDailyRefreshIso(date = new Date()) {
  const next = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 6),
  );

  if (next <= date) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.toISOString();
}

function rotatedPool(week = demoRotationWeek()) {
  const active = demoCompetitorPool.filter((competitor) => competitor.active);
  const offset = active.length ? week % active.length : 0;

  return [...active.slice(offset), ...active.slice(0, offset)];
}

function confidenceScore(confidence: Confidence) {
  return confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
}

function bestFact(facts: Array<StructuredFact | null | undefined>) {
  return facts
    .filter((fact): fact is StructuredFact => Boolean(fact))
    .sort((a, b) => b.confidence_score - a.confidence_score)[0];
}

function bestPageFact(
  pages: PageIntelligence[],
  fields: string[],
): StructuredFact | null {
  return bestFact(
    pages.flatMap((page) =>
      page.facts.filter((fact) => fields.includes(fact.field)),
    ),
  ) ?? null;
}

function pricingFact(pages: PageIntelligence[]) {
  return bestFact(
    pages.flatMap((page) => [
      page.pricing.lowestPrice,
      page.pricing.freePlan,
      page.pricing.contactSales,
    ]),
  ) ?? null;
}

function pricingText(fact: StructuredFact | null) {
  if (!fact) {
    return "No public pricing detected";
  }

  if (fact.field === "contact_sales") {
    return "Contact sales visible";
  }

  if (fact.field === "free_plan") {
    return "Free plan detected";
  }

  const normalized = fact.normalized_value;

  if (normalized && typeof normalized === "object" && "period" in normalized) {
    const period = normalized.period;

    return period && period !== "unknown"
      ? `Pricing detected: ${fact.value}/${period}`
      : `Pricing detected: ${fact.value}`;
  }

  return `Pricing detected: ${fact.value}`;
}

function featureText(pages: PageIntelligence[]) {
  const features = pages
    .flatMap((page) => page.features.features)
    .slice(0, 3)
    .map((feature) => feature.normalized_value?.name ?? feature.value);

  return features.length
    ? features.join(", ")
    : "Limited public feature data";
}

function resultConfidence(facts: StructuredFact[]): Confidence {
  const strongest = facts.reduce(
    (score, fact) => Math.max(score, confidenceScore(fact.confidence)),
    1,
  );

  return strongest === 3 ? "high" : strongest === 2 ? "medium" : "low";
}

function rowToExample(row: DemoExampleResult): DemoExample {
  const analysis =
    row.analysis_json && typeof row.analysis_json === "object"
      ? (row.analysis_json as Record<string, unknown>)
      : {};

  return {
    name: row.name,
    site_url: row.site_url,
    source_url: row.source_url,
    category: row.category,
    positioning:
      typeof analysis.positioning === "string"
        ? analysis.positioning
        : "Limited public positioning data",
    pricing:
      typeof analysis.pricing === "string"
        ? analysis.pricing
        : "No public pricing detected",
    cta: typeof analysis.cta === "string" ? analysis.cta : "No clear CTA",
    feature_signal:
      typeof analysis.features === "string"
        ? analysis.features
        : "Limited public feature data",
    evidence_text:
      Array.isArray(row.evidence_json) && typeof row.evidence_json[0] === "string"
        ? row.evidence_json[0]
        : "",
    confidence: row.confidence,
    last_verified_at: row.last_verified_at,
    analyzer_version: row.analyzer_version,
    status: row.status,
  };
}

export async function getDemoExamples(): Promise<DemoExamplesCache> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      updated_at: null,
      next_refresh_at: nextDailyRefreshIso(),
      refresh_status: "unavailable",
      examples: [],
    };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const week = demoRotationWeek();
    const { data: currentWeek } = await supabase
      .from("demo_example_results")
      .select("*")
      .eq("rotation_week", week)
      .eq("status", "success")
      .order("slot", { ascending: true })
      .limit(3);
    const rows = currentWeek?.length === 3
      ? currentWeek
      : (
          await supabase
            .from("demo_example_results")
            .select("*")
            .eq("status", "success")
            .order("last_verified_at", { ascending: false })
            .limit(3)
        ).data ?? [];
    const examples = rows.map(rowToExample);
    const updatedAt =
      rows
        .map((row) => row.last_verified_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;

    return {
      updated_at: updatedAt,
      next_refresh_at: nextDailyRefreshIso(),
      refresh_status: examples.length ? "ready" : "pending",
      examples,
    };
  } catch {
    return {
      updated_at: null,
      next_refresh_at: nextDailyRefreshIso(),
      refresh_status: "unavailable",
      examples: [],
    };
  }
}

async function analyzeDemoCompetitor(competitor: DemoCompetitor, slot: number) {
  const discovered = await discoverCompetitorPages(competitor.url);
  const pages = discovered
    .filter((page) => page.scrape.rawText && page.scrape.ok)
    .slice(0, 5)
    .map((page) =>
      analyzePageIntelligence({
        pageType: page.pageType,
        scrape: page.scrape,
      }),
    );

  if (!pages.length) {
    throw new Error("No useful public pages found.");
  }

  const positioning = bestPageFact(pages, [
    "homepage_headline",
    "main_value_prop",
    "subheadline",
  ]);
  const price = pricingFact(pages);
  const cta = bestPageFact(pages, ["primary_cta", "secondary_cta"]);
  const reliableFacts = [positioning, price, cta].filter(
    (fact): fact is StructuredFact => Boolean(fact),
  );

  if (!positioning || (!price && !cta)) {
    throw new Error("Reliable positioning plus pricing/CTA facts were not found.");
  }

  const evidence = reliableFacts.map((fact) => fact.evidence_text);
  const sourceUrl = price?.source_url ?? positioning.source_url;
  const analysisJson = {
    positioning: positioning.value,
    pricing: pricingText(price),
    cta: cta?.value ?? "No clear CTA",
    features: featureText(pages),
  };

  return {
    name: competitor.name,
    site_url: competitor.url,
    source_url: sourceUrl,
    category: competitor.category,
    slot,
    rotation_week: demoRotationWeek(),
    status: "success" as const,
    positioning_result: toJson(positioning),
    pricing_result: toJson(price ?? {}),
    cta_result: toJson(cta ?? {}),
    feature_result: toJson(pages.flatMap((page) => page.features.features)),
    changelog_result: toJson(
      pages.flatMap((page) => [
        page.changelog.changelogDetected,
        page.changelog.lastVisibleUpdateDate,
        ...page.changelog.recentUpdateTitles,
      ]),
    ),
    analysis_json: toJson(analysisJson),
    evidence_json: toJson(evidence),
    confidence: resultConfidence(reliableFacts),
    last_verified_at: new Date().toISOString(),
    analyzer_version: DEMO_ANALYZER_VERSION,
    failure_reason: null,
    updated_at: new Date().toISOString(),
  };
}

export async function refreshHomepageDemoExamples(): Promise<DemoRefreshResult> {
  const supabase = getSupabaseAdminClient();
  const week = demoRotationWeek();
  const saved: DemoExample[] = [];
  const errors: string[] = [];
  let attempted = 0;
  let slot = 0;

  for (const competitor of rotatedPool(week)) {
    if (saved.length >= 3) {
      break;
    }

    attempted += 1;

    try {
      const row = await analyzeDemoCompetitor(competitor, slot);
      const { data, error } = await supabase
        .from("demo_example_results")
        .upsert(row, { onConflict: "name,rotation_week" })
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      saved.push(rowToExample(data));
      slot += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Demo example refresh failed.";
      errors.push(`${competitor.name}: ${message}`);

      await supabase.from("demo_example_results").upsert(
        {
          name: competitor.name,
          site_url: competitor.url,
          source_url: competitor.url,
          category: competitor.category,
          slot: 999,
          rotation_week: week,
          status: "failed",
          analysis_json: toJson({}),
          evidence_json: toJson([]),
          confidence: "low",
          last_verified_at: null,
          analyzer_version: DEMO_ANALYZER_VERSION,
          failure_reason: message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "name,rotation_week" },
      );
    }
  }

  return {
    attempted,
    saved: saved.length,
    failed: attempted - saved.length,
    examples: saved,
    errors: errors.slice(0, 10),
    rotationWeek: week,
  };
}
