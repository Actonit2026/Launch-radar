import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import type { IntelligenceSummaryResult } from "@/lib/ai/intelligence-summary";
import type { PageIntelligence } from "@/lib/intelligence/types";

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
}: {
  supabase: Supabase;
  competitorId: string;
  pages: PageIntelligence[];
  summary: IntelligenceSummaryResult;
}) {
  const facts = pages.flatMap((page) => page.facts);
  const analyzedPages = pages.map((page) => ({
    source_url: page.sourceUrl,
    page_type: page.pageType,
    title: page.title,
    fetch_status: page.fetchStatus,
    content_hash: page.contentHash,
    extracted_text_length: page.extractedTextLength,
    fact_count: page.facts.length,
    warnings: page.warnings,
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
        summary: toJson(summary),
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
