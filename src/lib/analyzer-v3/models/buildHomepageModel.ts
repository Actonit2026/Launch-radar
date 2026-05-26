import type { AnalyzerEntity, EvidenceBlock, HomepageModelV3 } from "@/lib/analyzer-v3/types";
import { evidenceFromEntity, uniqueEvidence } from "@/lib/analyzer-v3/validation/evidence";

function companyFromTitle(title: string) {
  return title.split(/[|\-:]/)[0]?.trim() || null;
}

function inferTargetCustomer(text: string) {
  const match = text.match(/\b(?:for|built for|made for)\s+([^.\n]{4,80})/i)?.[1];
  return match ? match.replace(/\s+/g, " ").trim() : null;
}

export function buildHomepageModel({
  blocks,
  headlineEntities,
}: {
  blocks: EvidenceBlock[];
  headlineEntities: AnalyzerEntity<string>[];
}): HomepageModelV3 {
  const homepagePage = blocks.find((block) => block.page_type === "homepage");
  const headline = headlineEntities.find((entity) => entity.type === "headline" && entity.accepted) ?? null;
  const subheadline = headlineEntities.find((entity) => entity.type === "subheadline" && entity.accepted) ?? null;
  const heroText = blocks.find((block) => block.role === "hero")?.text ?? homepagePage?.text ?? "";
  const evidence = uniqueEvidence(
    [headline, subheadline].filter((entity): entity is AnalyzerEntity<string> => Boolean(entity)).map(evidenceFromEntity),
  );
  const target = inferTargetCustomer(heroText);
  const completeness = [headline, subheadline, target].filter(Boolean).length * 28 + (evidence.length ? 16 : 0);

  return {
    company_name: companyFromTitle(homepagePage?.heading_chain[0] ?? headline?.source_url ?? ""),
    headline: headline?.value ?? null,
    subheadline: subheadline?.value ?? null,
    positioning_statement: headline?.value ?? null,
    target_customer: target,
    value_prop: subheadline?.value ?? headline?.value ?? null,
    differentiation: null,
    evidence,
    confidence: headline ? "high" : "low",
    completeness: Math.min(100, completeness),
  };
}
