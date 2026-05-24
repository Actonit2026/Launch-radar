import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { summarizeIntelligence } from "@/lib/ai/intelligence-summary";
import { discoverCompetitorPages } from "@/lib/crawler/discovery";
import { analyzePageIntelligence } from "@/lib/intelligence/analyze";
import { buildBusinessProfile } from "@/lib/intelligence/business-profile";
import type { PageIntelligence } from "@/lib/intelligence/types";
import {
  buildProductRecommendations,
  parseStructuredFacts,
} from "@/lib/product-recommendations";
import { estimateScanCostEur, recordUsageEvent } from "@/lib/usage";
import { cleanupSnapshotRetentionForUser } from "@/lib/retention";

type Supabase = SupabaseClient<Database>;

type AnalyzeUserProductInput = {
  supabase: Supabase;
  userId: string;
  productId: string;
  productName: string;
  baseUrl: string;
  submittedPageUrl?: string;
};

type AnalyzeUserProductResult = {
  pagesAnalyzed: number;
  snapshotCreated: boolean;
  recommendationsCreated: number;
  warnings: string[];
};

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function analyzedPagePayload(pages: PageIntelligence[]) {
  return pages.map((page) => ({
    source_url: page.sourceUrl,
    page_type: page.pageType,
    title: page.title,
    fetch_status: page.fetchStatus,
    content_hash: page.contentHash,
    extracted_text_length: page.extractedTextLength,
    fact_count: page.facts.length,
    warnings: page.warnings,
  }));
}

async function updateProductScanStatus({
  supabase,
  productId,
  status,
  error,
}: {
  supabase: Supabase;
  productId: string;
  status: "pending" | "running" | "ready" | "failed" | "deferred";
  error?: string | null;
}) {
  const { error: updateError } = await supabase
    .from("user_products")
    .update({
      scan_status: status,
      error_message: error ?? null,
      last_scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function latestCompetitorSnapshots(supabase: Supabase, userId: string) {
  const { data: competitors, error } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  const snapshots = [];

  for (const competitor of competitors ?? []) {
    const { data: snapshot, error: snapshotError } = await supabase
      .from("competitor_intelligence_snapshots")
      .select("facts")
      .eq("competitor_id", competitor.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) {
      throw new Error(snapshotError.message);
    }

    const facts = snapshot ? parseStructuredFacts(snapshot.facts) : [];

    if (facts.length) {
      snapshots.push({
        competitorName: competitor.name,
        facts,
      });
    }
  }

  return snapshots;
}

export async function analyzeUserProduct({
  supabase,
  userId,
  productId,
  productName,
  baseUrl,
  submittedPageUrl,
}: AnalyzeUserProductInput): Promise<{
  data: AnalyzeUserProductResult | null;
  error?: string;
}> {
  await updateProductScanStatus({
    supabase,
    productId,
    status: "running",
  });

  const crawlWarning: string | null = null;

  try {
    const discoveredPages = await discoverCompetitorPages(baseUrl, {
      submittedPageUrl,
    });
    const intelligencePages = discoveredPages
      .filter((page) => page.scrape.ok && page.scrape.rawText)
      .map((page) =>
        analyzePageIntelligence({
          pageType: page.pageType,
          scrape: page.scrape,
        }),
      );

    if (!intelligencePages.length) {
      const error = "No useful public pages found for your product.";

      await updateProductScanStatus({
        supabase,
        productId,
        status: "failed",
        error,
      });

      return { data: null, error };
    }

    const summary = await summarizeIntelligence({
      competitorName: productName,
      pages: intelligencePages,
      supabase,
      userId,
    });
    const facts = intelligencePages.flatMap((page) => page.facts);
    const businessProfile = buildBusinessProfile({
      name: productName,
      pages: intelligencePages,
    });
    const warnings = unique([
      ...intelligencePages.flatMap((page) => page.warnings),
      ...summary.warnings,
      ...summary.unknowns,
      ...(crawlWarning ? [crawlWarning] : []),
    ]);
    const { error: snapshotError } = await supabase
      .from("product_snapshots")
      .insert({
        user_product_id: productId,
        user_id: userId,
        summary_json: toJson({
          ...summary,
          business_profile: businessProfile,
        }),
        structured_facts_json: toJson(facts),
        analyzed_pages: toJson(analyzedPagePayload(intelligencePages)),
        warnings,
        source: summary.source,
      });

    if (snapshotError) {
      throw new Error(snapshotError.message);
    }

    const competitorSnapshots = await latestCompetitorSnapshots(
      supabase,
      userId,
    );
    const recommendations = buildProductRecommendations({
      productFacts: facts,
      competitorSnapshots,
    });

    const { error: deleteError } = await supabase
      .from("product_recommendations")
      .delete()
      .eq("user_product_id", productId)
      .eq("user_id", userId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (recommendations.length) {
      const { error: recommendationsError } = await supabase
        .from("product_recommendations")
        .insert(
          recommendations.map((recommendation) => ({
            user_product_id: productId,
            user_id: userId,
            recommendation_type: recommendation.recommendation_type,
            title: recommendation.title,
            explanation: recommendation.explanation,
            why_this_matters: recommendation.why_this_matters,
            evidence_json: recommendation.evidence_json,
            confidence: recommendation.confidence,
            confidence_label: recommendation.confidence_label,
            actionability: recommendation.actionability,
          })),
        );

      if (recommendationsError) {
        throw new Error(recommendationsError.message);
      }

      await recordUsageEvent({
        supabase,
        userId,
        eventType: "recommendations_generated",
        quantity: recommendations.length,
        metadata: {
          product_id: productId,
          recommendation_types: recommendations.map(
            (recommendation) => recommendation.recommendation_type,
          ),
          confidence: recommendations.map((recommendation) => ({
            type: recommendation.recommendation_type,
            score: recommendation.confidence,
            label: recommendation.confidence_label,
          })),
        },
      });
    }

    await updateProductScanStatus({
      supabase,
      productId,
      status: "ready",
    });
    await recordUsageEvent({
      supabase,
      userId,
      eventType: "product_scan",
      quantity: intelligencePages.length,
      estimatedCostEur: estimateScanCostEur(intelligencePages.length),
      metadata: {
        product_id: productId,
        pages_analyzed: intelligencePages.length,
        recommendations_created: recommendations.length,
      },
    });

    await cleanupSnapshotRetentionForUser({
      supabase,
      userId,
    });

    return {
      data: {
        pagesAnalyzed: intelligencePages.length,
        snapshotCreated: true,
        recommendationsCreated: recommendations.length,
        warnings,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not analyze your product.";

    try {
      await updateProductScanStatus({
        supabase,
        productId,
        status: "failed",
        error: message,
      });
    } catch {
      // Preserve the original analysis error for the UI.
    }

    return { data: null, error: message };
  }
}
