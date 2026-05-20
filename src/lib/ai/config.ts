import OpenAI from "openai";

export const OPENAI_NOT_CONFIGURED_ERROR = "OPENAI_API_KEY is not configured.";

export function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_SUMMARY_MODEL ?? "gpt-5.4-mini";

  if (!apiKey) {
    return null;
  }

  return { apiKey, model };
}

export function createOpenAIClient(apiKey: string) {
  return new OpenAI({ apiKey });
}
