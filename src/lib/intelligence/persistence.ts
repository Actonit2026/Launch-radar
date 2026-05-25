import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import type { IntelligenceSummaryResult } from "@/lib/ai/intelligence-summary";
import { buildBusinessProfile } from "@/lib/intelligence/business-profile";
import type { PageIntelligence } from "@/lib/intelligence/types";
import type { ScanQualitySummary } from "@/lib/scan-quality";

type Supabase = SupabaseClient<Database>;
type ScanStatus = "pending" | "running" | "ready" | "failed";

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function updateCompetitorScanStatus({
  supabase,
  competitorId,
  status,
  error,
}: {
  supabase: Supabase;
  competitorId: string;
  status: ScanStatus;
  error?: string | null;
}) {
  try {
    const { error: updateError } = await supabase
      .from("competitors")
      .update({
        scan_status: status,
        last_scan_at: new Date().toISOString(),
        last_scan_error: error ?? null,
      })
      .eq("id", competitorId);

    return updateError?.message ?? null;
  } catch (caught) {
    return caught instanceof Error ? caught.message : "Could not update scan status.";
  }
}

export async function saveCompetitorIntelligenceSnapshot({
  supabase,
  competitorId,
  pages,
  summary,
  scanQuality,
}: {
  supabase: Supabase;
  competitorId: string;
  pages: PageIntelligence[];
  summary: IntelligenceSummaryResult;
  scanQuality?: ScanQualitySummary;
}) {
  const facts = pages.flatMap((page) => page.facts);
  const businessProfile = buildBusinessProfile({
    name: null,
    pages,
  });
  const analyzedPages = pages.map((page) => ({
    source_url: page.sourceUrl,
    page_type: page.pageType,
    detected_page_type: page.detectedPageType,
    page_type_verified: page.pageValidation.page_type_verified,
    valid_for_intelligence: page.validForIntelligence,
    intelligence_status: page.intelligenceStatus,
    page_validation: page.pageValidation,
    title: page.title,
    fetch_status: page.fetchStatus,
    content_hash: page.contentHash,
    extracted_text_length: page.extractedTextLength,
    fact_count: page.facts.length,
    warnings: page.warnings,
    models: page.models,
  }));
  const warnings = unique([
    ...pages.flatMap((page) => page.warnings),
    ...summary.warnings,
    ...summary.unknowns,
  ]);

  try {
    const { error } = await supabase
      .from("competitor_intelligence_snapshots")
      .insert({
        competitor_id: competitorId,
        summary: toJson({
          ...summary,
          business_profile: businessProfile,
          scan_quality: scanQuality ?? null,
        }),
        facts: toJson(facts),
        analyzed_pages: toJson(analyzedPages),
        warnings,
        source: summary.source,
      });

    return error?.message ?? null;
  } catch (caught) {
    return caught instanceof Error
      ? caught.message
      : "Could not save intelligence snapshot.";
  }
}
