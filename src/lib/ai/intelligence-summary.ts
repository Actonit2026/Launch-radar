import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_SUMMARY_UNAVAILABLE_MESSAGE,
  createOpenAIClient,
  getOpenAIConfig,
  OPENAI_NOT_CONFIGURED_ERROR,
} from "@/lib/ai/config";
import type { Database, Json } from "@/lib/database.types";
import type {
  Confidence,
  PageIntelligence,
  StructuredFact,
} from "@/lib/intelligence/types";
import {
  canRunAiSummary,
  estimateAiCostEur,
  getPlanForUser,
  recordUsageEvent,
} from "@/lib/usage";

export type IntelligenceSummary = {
  executive_summary: string | null;
  pricing_summary: string | null;
  positioning_summary: string | null;
  feature_summary: string | null;
  cta_summary: string | null;
  unknowns: string[];
  warnings: string[];
  overall_confidence: Confidence;
};

export type IntelligenceSummaryResult = IntelligenceSummary & {
  source: "openai" | "deterministic";
  error?: string;
};

type SummarizeIntelligenceInput = {
  competitorName: string;
  pages: PageIntelligence[];
  supabase?: SupabaseClient<Database>;
  userId?: string;
};

const intelligenceSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "executive_summary",
    "pricing_summary",
    "positioning_summary",
    "feature_summary",
    "cta_summary",
    "unknowns",
    "warnings",
    "overall_confidence",
  ],
  properties: {
    executive_summary: {
      type: ["string", "null"],
      description:
        "One concise summary using only supplied facts, or null if facts are too weak.",
    },
    pricing_summary: {
      type: ["string", "null"],
      description:
        "Pricing summary supported by pricing facts, or null when unavailable.",
    },
    positioning_summary: {
      type: ["string", "null"],
      description:
        "Positioning summary supported by positioning facts, or null when unclear.",
    },
    feature_summary: {
      type: ["string", "null"],
      description:
        "Feature summary supported by feature facts, or null when insufficient.",
    },
    cta_summary: {
      type: ["string", "null"],
      description: "CTA summary supported by CTA facts, or null when absent.",
    },
    unknowns: {
      type: "array",
      items: { type: "string" },
      description: "Important missing or unclear areas.",
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Reliability warnings based only on supplied facts.",
    },
    overall_confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
  },
} as const;

function compactFact(fact: StructuredFact) {
  return {
    field: fact.field,
    value: fact.value,
    normalized_value: fact.normalized_value ?? null,
    confidence: fact.confidence,
    confidence_score: fact.confidence_score,
    source_url: fact.source_url,
    evidence_text: fact.evidence_text,
    extraction_method: fact.extraction_method,
  };
}

function compactPages(pages: PageIntelligence[]) {
  return pages.map((page) => ({
    source_url: page.sourceUrl,
    page_type: page.pageType,
    detected_page_type: page.detectedPageType,
    page_type_verified: page.pageValidation.page_type_verified,
    valid_for_intelligence: page.validForIntelligence,
    intelligence_status: page.intelligenceStatus,
    title: page.title,
    fetch_status: page.fetchStatus,
    content_hash: page.contentHash,
    extracted_text_length: page.extractedTextLength,
    facts: page.facts.slice(0, 40).map(compactFact),
    warnings: page.warnings,
  }));
}

function cacheKeyForInput({
  model,
  pages,
}: {
  model: string;
  pages: PageIntelligence[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        model,
        pages: compactPages(pages).map((page) => ({
          source_url: page.source_url,
          page_type: page.page_type,
          content_hash: page.content_hash,
          facts: page.facts,
        })),
      }),
    )
    .digest("hex");
}

function factsByField(pages: PageIntelligence[], field: string) {
  return pages
    .flatMap((page) => page.facts)
    .filter((fact) => fact.field === field);
}

function bestFact(facts: StructuredFact[]) {
  return [...facts].sort(
    (a, b) => b.confidence_score - a.confidence_score,
  )[0];
}

function summaryFromFact(fact: StructuredFact | undefined) {
  return fact ? `${fact.value} Source: ${fact.source_url}` : null;
}

function confidenceFromFacts(facts: StructuredFact[]): Confidence {
  const highFacts = facts.filter((fact) => fact.confidence === "high").length;
  const mediumFacts = facts.filter(
    (fact) => fact.confidence === "medium",
  ).length;

  if (highFacts >= 3) {
    return "high";
  }

  if (highFacts + mediumFacts >= 3) {
    return "medium";
  }

  return "low";
}

function deterministicSummary({
  pages,
}: SummarizeIntelligenceInput): IntelligenceSummaryResult {
  const facts = pages.flatMap((page) => page.facts);
  const warnings = Array.from(
    new Set(pages.flatMap((page) => page.warnings)),
  );
  const lowestPrice = bestFact(factsByField(pages, "visible_price"));
  const structuredPricing = bestFact([
    ...factsByField(pages, "pricing_plan"),
    ...factsByField(pages, "usage_tier"),
  ]);
  const contactSales = bestFact(factsByField(pages, "contact_sales"));
  const headline = bestFact(factsByField(pages, "homepage_headline"));
  const valueProp = bestFact(factsByField(pages, "main_value_prop"));
  const features = factsByField(pages, "feature").slice(0, 3);
  const primaryCta = bestFact(factsByField(pages, "primary_cta"));
  const unknowns: string[] = [];

  if (!lowestPrice && !structuredPricing && !contactSales) {
    unknowns.push("No public pricing block detected on this URL.");
  }

  if (!headline && !valueProp) {
    unknowns.push("Positioning unclear from public page content.");
  }

  if (features.length < 3) {
    unknowns.push("Not enough feature information detected.");
  }

  const pricingSummary = lowestPrice
    ? summaryFromFact(lowestPrice)
    : structuredPricing
      ? summaryFromFact(structuredPricing)
    : contactSales
      ? summaryFromFact(contactSales)
      : null;
  const positioningSummary = headline
    ? summaryFromFact(headline)
    : summaryFromFact(valueProp);
  const featureSummary = features.length
    ? `${features.map((feature) => feature.value).join("; ")} Source: ${
        features[0].source_url
      }`
    : null;
  const ctaSummary = summaryFromFact(primaryCta);
  const executiveSummary =
    positioningSummary || pricingSummary || featureSummary
      ? [
          positioningSummary,
          pricingSummary,
          featureSummary,
          ctaSummary,
        ]
          .filter(Boolean)
          .slice(0, 2)
          .join(" ")
      : "Initial scan completed, but reliable public data was limited.";

  return {
    executive_summary: executiveSummary,
    pricing_summary: pricingSummary,
    positioning_summary: positioningSummary,
    feature_summary: featureSummary,
    cta_summary: ctaSummary,
    unknowns,
    warnings,
    overall_confidence: confidenceFromFacts(facts),
    source: "deterministic",
  };
}

function isConfidence(value: unknown): value is Confidence {
  return value === "high" || value === "medium" || value === "low";
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseSummary(
  value: string,
  fallback: IntelligenceSummaryResult,
): IntelligenceSummaryResult {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  const overallConfidence = parsed.overall_confidence;

  if (!isConfidence(overallConfidence)) {
    return {
      ...fallback,
      error: "OpenAI intelligence summary did not match the expected shape.",
    };
  }

  return {
    executive_summary: stringOrNull(parsed.executive_summary),
    pricing_summary: stringOrNull(parsed.pricing_summary),
    positioning_summary: stringOrNull(parsed.positioning_summary),
    feature_summary: stringOrNull(parsed.feature_summary),
    cta_summary: stringOrNull(parsed.cta_summary),
    unknowns: stringArray(parsed.unknowns),
    warnings: stringArray(parsed.warnings),
    overall_confidence: overallConfidence,
    source: "openai",
  };
}

function parseSummaryRecord(
  value: Json,
): IntelligenceSummaryResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const summary = value as Record<string, unknown>;
  const overallConfidence = summary.overall_confidence;

  if (!isConfidence(overallConfidence)) {
    return null;
  }

  return {
    executive_summary: stringOrNull(summary.executive_summary),
    pricing_summary: stringOrNull(summary.pricing_summary),
    positioning_summary: stringOrNull(summary.positioning_summary),
    feature_summary: stringOrNull(summary.feature_summary),
    cta_summary: stringOrNull(summary.cta_summary),
    unknowns: stringArray(summary.unknowns),
    warnings: stringArray(summary.warnings),
    overall_confidence: overallConfidence,
    source: "openai",
  };
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function estimateTokens(value: string) {
  return Math.ceil(value.length / 4);
}

export async function summarizeIntelligence(
  input: SummarizeIntelligenceInput,
): Promise<IntelligenceSummaryResult> {
  const fallback = deterministicSummary(input);
  const config = getOpenAIConfig();
  const facts = input.pages.flatMap((page) => page.facts);

  if (!config) {
    return {
      ...fallback,
      warnings: Array.from(
        new Set([...fallback.warnings, AI_SUMMARY_UNAVAILABLE_MESSAGE]),
      ),
      error: OPENAI_NOT_CONFIGURED_ERROR,
    };
  }

  if (!facts.length) {
    return fallback;
  }

  const aiInput = JSON.stringify({
    competitor_name: input.competitorName,
    analyzed_pages: compactPages(input.pages),
  });
  const estimatedInputTokens = estimateTokens(aiInput);
  const cacheKey = cacheKeyForInput({
    model: config.model,
    pages: input.pages,
  });

  if (input.supabase && input.userId) {
    const { data: cached } = await input.supabase
      .from("ai_summary_cache")
      .select("summary_json")
      .eq("user_id", input.userId)
      .eq("cache_key", cacheKey)
      .maybeSingle();
    const cachedSummary = cached
      ? parseSummaryRecord(cached.summary_json)
      : null;

    if (cachedSummary) {
      return cachedSummary;
    }

    const plan = await getPlanForUser(input.supabase, input.userId);

    if (plan.name === "free") {
      return {
        ...fallback,
        warnings: Array.from(
          new Set([...fallback.warnings, AI_SUMMARY_UNAVAILABLE_MESSAGE]),
        ),
      };
    }

    const budget = await canRunAiSummary({
      supabase: input.supabase,
      userId: input.userId,
      estimatedTokens: estimatedInputTokens,
    });

    if (!budget.allowed) {
      return {
        ...fallback,
        warnings: Array.from(
          new Set([...fallback.warnings, AI_SUMMARY_UNAVAILABLE_MESSAGE]),
        ),
      };
    }
  }

  try {
    const client = createOpenAIClient(config.apiKey);
    const response = await client.responses.create({
      model: config.model,
      instructions: [
        "You are summarizing verified website analysis facts.",
        "Only use the facts provided. Do not infer, guess, or invent.",
        "If facts are missing, say unknown. Avoid generic summaries.",
        "Every summary sentence must be supported by provided evidence.",
      ].join(" "),
      input: aiInput,
      text: {
        format: {
          type: "json_schema",
          name: "verified_competitor_intelligence_summary",
          strict: true,
          schema: intelligenceSummarySchema,
        },
      },
    });
    const parsed = parseSummary(response.output_text, fallback);
    const outputTokens = estimateTokens(response.output_text);
    const totalTokens = estimatedInputTokens + outputTokens;

    if (input.supabase && input.userId) {
      await input.supabase.from("ai_summary_cache").upsert(
        {
          user_id: input.userId,
          cache_key: cacheKey,
          model: config.model,
          summary_json: toJson(parsed),
          source: parsed.source,
        },
        { onConflict: "user_id,cache_key" },
      );
      await recordUsageEvent({
        supabase: input.supabase,
        userId: input.userId,
        eventType: "ai_summary",
        quantity: totalTokens,
        estimatedCostEur: estimateAiCostEur(totalTokens),
        metadata: {
          model: config.model,
          input_tokens_estimate: estimatedInputTokens,
          output_tokens_estimate: outputTokens,
          cache_key: cacheKey,
        },
      });
    }

    return parsed;
  } catch (error) {
    return {
      ...fallback,
      warnings: Array.from(
        new Set([...fallback.warnings, AI_SUMMARY_UNAVAILABLE_MESSAGE]),
      ),
      error:
        error instanceof Error
          ? error.message
          : "OpenAI intelligence summary generation failed.",
    };
  }
}
