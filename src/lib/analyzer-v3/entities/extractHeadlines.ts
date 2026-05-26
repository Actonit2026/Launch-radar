import type { AnalyzerEntity, EvidenceBlock } from "@/lib/analyzer-v3/types";

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function contaminated(value: string) {
  return /\b(?:example|sample|proposal sample|job post|budget|testimonial|case study|article)\b/i.test(value);
}

export function extractHeadlines(blocks: EvidenceBlock[]) {
  const entities: AnalyzerEntity<string>[] = [];
  const homepageBlocks = blocks.filter(
    (block) =>
      block.page_type === "homepage" &&
      !["proposal_sample", "example_output", "job_example", "testimonial", "case_study"].includes(block.role),
  );
  const hero =
    homepageBlocks.find((block) => block.css_classes.some((className) => /hero|masthead/i.test(className)) && block.local_heading) ??
    homepageBlocks.find((block) => ["hero", "cta_section", "positioning"].includes(block.role) && block.local_heading) ??
    homepageBlocks.find((block) => block.local_heading);

  if (!hero) {
    return entities;
  }

  const lines = hero.text.split(/\n+/).map(clean).filter(Boolean);
  const headline = clean(hero.local_heading ?? lines.find((line) => line.length >= 12 && line.length <= 120) ?? "");
  const subheadline = lines.find((line) => line !== headline && line.length >= 24 && line.length <= 220) ?? null;

  if (headline && !contaminated(headline)) {
    entities.push({
      id: `${hero.id}:headline`,
      type: "headline",
      value: headline,
      normalized_value: headline,
      source_block_id: hero.id,
      source_url: hero.final_url,
      evidence_text: hero.text.slice(0, 260),
      context_role: hero.role,
      confidence: "high",
      confidence_score: 0.9,
      accepted: true,
      rejection_reason: null,
    });
  }

  if (subheadline && !contaminated(subheadline)) {
    entities.push({
      id: `${hero.id}:subheadline`,
      type: "subheadline",
      value: subheadline,
      normalized_value: subheadline,
      source_block_id: hero.id,
      source_url: hero.final_url,
      evidence_text: hero.text.slice(0, 260),
      context_role: hero.role,
      confidence: "medium",
      confidence_score: 0.76,
      accepted: true,
      rejection_reason: null,
    });
  }

  return entities;
}
