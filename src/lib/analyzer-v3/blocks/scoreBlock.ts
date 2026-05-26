import type { EvidenceBlock } from "@/lib/analyzer-v3/types";

export function scoreBlock(block: EvidenceBlock) {
  let score = block.role_confidence;

  score += block.nearby_prices.length ? 0.08 : 0;
  score += block.nearby_plan_words.length ? 0.06 : 0;
  score += block.button_texts.length ? 0.04 : 0;
  score -= block.nearby_negative_words.length ? 0.25 : 0;

  if (["testimonial", "case_study", "proposal_sample", "job_example", "example_output"].includes(block.role)) {
    score = Math.min(score, 0.25);
  }

  return Number(Math.max(0, Math.min(1, score)).toFixed(2));
}
