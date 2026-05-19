import OpenAI from "openai";
import type { DetectedChange, PageType } from "@/lib/database.types";
import type { DiffResult } from "@/lib/diff-engine";
import { formatPageType } from "@/lib/format";

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
};

export const OPENAI_NOT_CONFIGURED_ERROR = "OPENAI_API_KEY is not configured.";

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

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_SUMMARY_MODEL ?? "gpt-5.4-mini";

  if (!apiKey) {
    return null;
  }

  return { apiKey, model };
}

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

function compactLines(lines: string[]) {
  return lines.slice(0, 8).map((line) => line.slice(0, 220));
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

  try {
    const client = new OpenAI({ apiKey: config.apiKey });
    const response = await client.responses.create({
      model: config.model,
      instructions: [
        "Summarize competitor website changes for a SaaS founder.",
        "Focus on pricing changes, feature launches, positioning changes, CTA changes, and why the founder should care.",
        "Be concrete. Do not invent details not present in the diff.",
      ].join(" "),
      input: JSON.stringify({
        competitor_name: input.competitorName,
        page_type: formatPageType(input.pageType),
        page_url: input.pageUrl,
        heuristic_summary: input.diff.summary,
        heuristic_severity: input.diff.severity,
        additions: compactLines(input.diff.additions),
        removals: compactLines(input.diff.removals),
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
