import type { DetectedChange, PageType } from "@/lib/database.types";
import {
  createOpenAIClient,
  getOpenAIConfig,
  OPENAI_NOT_CONFIGURED_ERROR,
} from "@/lib/ai/config";
import type { DiffResult } from "@/lib/diff-engine";
import { formatPageType } from "@/lib/format";
import type { StructuredFact } from "@/lib/intelligence/types";

type Severity = DetectedChange["severity"];

export type ChangeSummary = {
  summary: string;
  severity: Severity;
  whyItMatters: string;
  source: "openai" | "heuristic";
  error?: string;
};

type SummaryInput = {
  competitorName: string;
  pageType: PageType;
  pageUrl: string;
  diff: DiffResult;
  facts?: StructuredFact[];
};

export { OPENAI_NOT_CONFIGURED_ERROR } from "@/lib/ai/config";

const summarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "severity", "why_it_matters"],
  properties: {
    summary: {
      type: "string",
      description:
        "One concise sentence describing the meaningful website change.",
    },
    severity: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "How important the change is for a SaaS founder.",
    },
    why_it_matters: {
      type: "string",
      description:
        "One short sentence explaining the competitive implication.",
    },
  },
} as const;

function heuristicSummary(diff: DiffResult): ChangeSummary {
  return {
    summary: diff.summary,
    severity: diff.severity,
    whyItMatters: diff.whyItMatters,
    source: "heuristic",
  };
}

function isSeverity(value: unknown): value is Severity {
  return value === "low" || value === "medium" || value === "high";
}

function compactFacts(facts: StructuredFact[]) {
  return facts.slice(0, 20).map((fact) => ({
    field: fact.field,
    value: fact.value,
    confidence: fact.confidence,
    confidence_score: fact.confidence_score,
    source_url: fact.source_url,
    evidence_text: fact.evidence_text,
    extraction_method: fact.extraction_method,
    normalized_value: fact.normalized_value ?? null,
  }));
}

function parseSummary(value: string, fallback: ChangeSummary): ChangeSummary {
  const parsed = JSON.parse(value) as {
    summary?: unknown;
    severity?: unknown;
    why_it_matters?: unknown;
  };

  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.why_it_matters !== "string" ||
    !isSeverity(parsed.severity)
  ) {
    return {
      ...fallback,
      error: "OpenAI summary did not match the expected shape.",
    };
  }

  return {
    summary: parsed.summary.trim(),
    severity: parsed.severity,
    whyItMatters: parsed.why_it_matters.trim(),
    source: "openai",
  };
}

export function isOpenAISummaryConfigured() {
  return Boolean(getOpenAIConfig());
}

export async function summarizeChange(input: SummaryInput) {
  const fallback = heuristicSummary(input.diff);
  const config = getOpenAIConfig();

  if (!config) {
    return {
      ...fallback,
      error: OPENAI_NOT_CONFIGURED_ERROR,
    };
  }

  if (!input.facts?.length) {
    return fallback;
  }

  try {
    const client = createOpenAIClient(config.apiKey);
    const response = await client.responses.create({
      model: config.model,
      instructions: [
        "Summarize competitor website changes using only verified structured facts.",
        "Do not infer, guess, or invent. Every sentence must be supported by the provided source_url and evidence_text fields.",
        "If facts are missing or weak, say the reliable public data was limited.",
      ].join(" "),
      input: JSON.stringify({
        competitor_name: input.competitorName,
        page_type: formatPageType(input.pageType),
        page_url: input.pageUrl,
        heuristic_summary: input.diff.summary,
        heuristic_severity: input.diff.severity,
        structured_facts: compactFacts(input.facts),
      }),
      text: {
        format: {
          type: "json_schema",
          name: "competitor_change_summary",
          strict: true,
          schema: summarySchema,
        },
      },
    });

    return parseSummary(response.output_text, fallback);
  } catch (error) {
    return {
      ...fallback,
      error:
        error instanceof Error
          ? error.message
          : "OpenAI summary generation failed.",
    };
  }
}
