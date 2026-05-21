import demoExamples from "@/data/demo-examples.json";

export type DemoExample = {
  name: string;
  site_url: string;
  source_url: string;
  positioning: string;
  pricing: string;
  cta: string;
  feature_signal: string;
  evidence_text: string;
  confidence: "high" | "medium" | "low";
};

export type DemoExamplesCache = {
  updated_at: string | null;
  examples: DemoExample[];
};

export function getDemoExamples(): DemoExamplesCache {
  return demoExamples as DemoExamplesCache;
}
