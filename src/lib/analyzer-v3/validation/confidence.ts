import type { AnalyzerV3Confidence } from "@/lib/analyzer-v3/types";

export function confidenceFromScore(score: number): AnalyzerV3Confidence {
  if (score >= 0.8) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

export function scoreFromConfidence(confidence: AnalyzerV3Confidence) {
  if (confidence === "high") return 0.9;
  if (confidence === "medium") return 0.7;
  return 0.4;
}

export function combineConfidence(scores: number[]) {
  if (!scores.length) return "low" as const;
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return confidenceFromScore(average);
}
