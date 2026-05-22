import OpenAI from "openai";

export const OPENAI_NOT_CONFIGURED_ERROR = "OPENAI_API_KEY is not configured.";
export const AI_SUMMARY_UNAVAILABLE_MESSAGE =
  "AI summary unavailable. Showing deterministic analysis.";

export function aiSummariesEnabled() {
  return process.env.ENABLE_AI_SUMMARIES !== "false";
}

export function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_SUMMARY_MODEL ?? "gpt-5.4-mini";

  if (!apiKey || !aiSummariesEnabled()) {
    return null;
  }

  return { apiKey, model };
}

export function createOpenAIClient(apiKey: string) {
  return new OpenAI({ apiKey });
}
