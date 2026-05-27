import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzerV3Enabled,
  analyzerV3ShadowMode,
  compareBusinessModels,
} from "@/lib/analyzer-v3";
import {
  pricingDisplayCounts,
  buildV3PricingDisplayContract,
} from "@/lib/analyzer-v3/pricing-display";
import type {
  AnalyzerV3Result,
  BusinessModelV3,
  ModelEvidence,
} from "@/lib/analyzer-v3/types";
import type { Database, Json, MonitoredPage } from "@/lib/database.types";

type Supabase = SupabaseClient<Database>;

type V3SnapshotRow = {
  id: string;
  business_model: Json;
  validity: string;
  confidence: string;
  created_at: string;
};

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseBusinessModel(value: Json): BusinessModelV3 | null {
  return isRecord(value) && isRecord(value.pricing) && isRecord(value.cta)
    ? (value as unknown as BusinessModelV3)
    : null;
}

function evidenceCount(result: AnalyzerV3Result) {
  const modelEvidence = [
    ...result.business_model.evidence_summary,
    ...result.business_model.pricing.evidence,
    ...result.business_model.homepage.evidence,
    ...result.business_model.cta.evidence,
    ...result.business_model.features.evidence,
    ...result.business_model.changelog.evidence,
  ];
  const entityEvidence = result.debug_admin_only.accepted_entities.map(
    (entity) => entity.evidence_text,
  );

  return new Set([
    ...modelEvidence.map((item) => `${item.source_url}:${item.evidence_text}`),
    ...entityEvidence,
  ]).size;
}

function sourcePages(result: AnalyzerV3Result) {
  return result.pages.map((page) => ({
    requested_url: page.page.requested_url,
    final_url: page.page.final_url,
    title: page.page.title,
    requested_page_type: page.requested_page_type,
    detected_page_type: page.page_type_result.detected_page_type,
    extraction_allowed: page.page_type_result.extraction_allowed,
    fetch_status: page.page.status_code,
    content_hash: page.page.text_hash,
    extracted_text_length: page.page.text.length,
    warnings: page.page.warnings,
  }));
}

function primaryMonitoredPageId(pages?: MonitoredPage[]) {
  return (
    pages?.find((page) => page.page_type === "homepage")?.id ??
    pages?.[0]?.id ??
    null
  );
}

function categoryForChangeType(type: string) {
  if (/pricing/i.test(type)) return "pricing";
  if (/cta/i.test(type)) return "cta";
  if (/feature/i.test(type)) return "features";
  if (/positioning|headline|target/i.test(type)) return "positioning";
  return "intelligence";
}

function severityForConfidence(confidence: number): "low" | "medium" | "high" {
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.82) return "medium";
  return "low";
}

function compactEvidence(evidence: ModelEvidence[]) {
  return evidence.slice(0, 8).map((item) => ({
    source_url: item.source_url,
    evidence_text: item.evidence_text,
    source_block_id: item.source_block_id ?? null,
    confidence: item.confidence,
  }));
}

export async function latestV3IntelligenceSnapshot(
  supabase: Supabase,
  competitorId: string,
) {
  const { data, error } = await supabase
    .from("v3_intelligence_snapshots")
    .select("id, business_model, validity, confidence, created_at")
    .eq("competitor_id", competitorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data as V3SnapshotRow | null) ?? null, error: null };
}

export async function saveV3IntelligenceSnapshot({
  supabase,
  userId,
  competitorId,
  analyzedUrl,
  result,
  monitoredPages,
  createChanges = true,
}: {
  supabase: Supabase;
  userId: string | null | undefined;
  competitorId: string;
  analyzedUrl: string;
  result: AnalyzerV3Result | null;
  monitoredPages?: MonitoredPage[];
  createChanges?: boolean;
}) {
  if (!analyzerV3Enabled() || !result || !userId) {
    return { snapshotCreated: false, changesCreated: 0, error: null };
  }

  const previous = await latestV3IntelligenceSnapshot(supabase, competitorId);
  const previousModel = previous.data
    ? parseBusinessModel(previous.data.business_model)
    : null;

  const { data, error } = await supabase
    .from("v3_intelligence_snapshots")
    .insert({
      user_id: userId,
      competitor_id: competitorId,
      analyzed_url: analyzedUrl,
      canonical_url: result.canonical_url,
      analyzer_version: result.analyzer_version,
      business_model: toJson(result.business_model),
      pricing_model: toJson(result.business_model.pricing_model),
      homepage_model: toJson(result.business_model.homepage_model),
      positioning_model: toJson(result.business_model.positioning_model),
      cta_model: toJson(result.business_model.cta_model),
      feature_model: toJson(result.business_model.feature_model),
      changelog_model: toJson(result.business_model.changelog_model),
      availability_model: toJson(result.business_model.availability_model),
      validity: result.validity,
      confidence: result.confidence,
      completeness: result.completeness,
      evidence_count: evidenceCount(result),
      rejected_entities: toJson(result.rejected_entities),
      warnings: toJson(result.warnings),
      source_pages: toJson(sourcePages(result)),
    })
    .select("id")
    .single();

  if (error) {
    return { snapshotCreated: false, changesCreated: 0, error: error.message };
  }

  if (
    !createChanges ||
    !previousModel ||
    result.validity === "invalid_for_intelligence" ||
    result.confidence === "low"
  ) {
    return { snapshotCreated: true, changesCreated: 0, error: null };
  }

  const monitoredPageId = primaryMonitoredPageId(monitoredPages);

  if (!monitoredPageId) {
    return { snapshotCreated: true, changesCreated: 0, error: null };
  }

  const decisions = compareBusinessModels(previousModel, result.business_model)
    .filter((decision) => !decision.suppressed && decision.confidence >= 0.82)
    .slice(0, 8);

  if (!decisions.length) {
    return { snapshotCreated: true, changesCreated: 0, error: null };
  }

  const payloads = decisions.map((decision) => ({
    monitored_page_id: monitoredPageId,
    diff_summary: decision.summary,
    severity: severityForConfidence(decision.confidence),
    change_type: decision.type,
    confidence_score: decision.confidence,
    evidence_json: toJson({
      analyzer_version: "v3",
      source_snapshot_id: data.id,
      decision,
      evidence: compactEvidence(result.business_model.evidence_summary),
    }),
    category: categoryForChangeType(decision.type),
    old_value: toJson(previousModel),
    new_value: toJson(result.business_model),
    evidence_text: decision.summary,
    analyzer_version: "v3",
    change_model_type: categoryForChangeType(decision.type),
    source_snapshot_id: data.id,
    status: "active" as const,
  }));

  const { error: changeError } = await supabase
    .from("detected_changes")
    .insert(payloads);

  return {
    snapshotCreated: true,
    changesCreated: changeError ? 0 : payloads.length,
    error: changeError?.message ?? null,
  };
}

export async function saveV3ShadowOutput({
  supabase,
  userId,
  competitorId,
  monitoredPageId = null,
  result,
  oldAnalyzerSummary,
  displayedPriceCount,
}: {
  supabase: Supabase;
  userId: string | null | undefined;
  competitorId: string;
  monitoredPageId?: string | null;
  result: AnalyzerV3Result | null;
  oldAnalyzerSummary?: unknown;
  displayedPriceCount?: number | null;
}) {
  if (!analyzerV3ShadowMode() || !result || !userId) {
    return null;
  }

  const counts = pricingDisplayCounts(result.business_model);
  const contract = buildV3PricingDisplayContract(result.business_model);
  const dangerousOutput =
    counts.dangerous_output ||
    (typeof displayedPriceCount === "number" &&
      displayedPriceCount > counts.accepted_price_count);

  const { error } = await supabase.from("v3_shadow_output").insert({
    user_id: userId,
    competitor_id: competitorId,
    monitored_page_id: monitoredPageId,
    analyzer_version: result.analyzer_version,
    old_analyzer_summary: toJson(oldAnalyzerSummary ?? {}),
    business_model: toJson(result.business_model),
    validity: result.validity,
    confidence: result.confidence,
    pricing_status: result.business_model.pricing.status,
    pricing_confidence: result.business_model.pricing.confidence,
    accepted_price_count: counts.accepted_price_count,
    rejected_price_count: counts.rejected_price_count,
    displayed_price_count:
      typeof displayedPriceCount === "number"
        ? displayedPriceCount
        : counts.displayed_price_count,
    dangerous_output: dangerousOutput,
    comparison_notes: toJson({
      invariant_ok: contract.invariant_ok,
      invariant_reason: contract.invariant_reason,
      warnings: contract.warnings,
      validity: result.validity,
      completeness: result.completeness,
    }),
  });

  return error?.message ?? null;
}
