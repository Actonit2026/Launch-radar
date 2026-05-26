import type { AnalyzerEntity, EvidenceBlock } from "@/lib/analyzer-v3/types";

const rejectCta = /^(?:login|log in|sign in|docs|documentation|support|privacy|terms|legal|status|blog)$/i;

function ctaType(value: string) {
  if (/\b(?:start trial|try free|start free)\b/i.test(value)) return "start_trial";
  if (/\b(?:book demo|schedule demo|request demo)\b/i.test(value)) return "book_demo";
  if (/\b(?:contact sales|talk to sales)\b/i.test(value)) return "contact_sales";
  if (/\b(?:sign up|signup|join)\b/i.test(value)) return "sign_up";
  if (/\bdownload\b/i.test(value)) return "download";
  if (/\b(?:pricing|plans)\b/i.test(value)) return "view_pricing";
  if (/\bget started\b/i.test(value)) return "get_started";
  if (/\b(?:upgrade|buy|get plus|get pro|subscribe)\b/i.test(value)) return "upgrade_buy";
  return "unknown";
}

function rolePriority(role: string) {
  if (role === "hero") return 1;
  if (role === "pricing_card") return 2;
  if (role === "cta_section") return 3;
  if (role === "pricing_section") return 4;
  return 8;
}

export function extractCtas(blocks: EvidenceBlock[]) {
  const entities: AnalyzerEntity<{ intent: string; destination_url: string | null; priority: number }>[] = [];

  blocks.forEach((block) => {
    block.button_texts.forEach((text, index) => {
      const normalized = text.replace(/\s+/g, " ").trim();
      const rejected = rejectCta.test(normalized);
      const intent = ctaType(normalized);
      const productCta = intent !== "unknown";

      entities.push({
        id: `${block.id}:cta:${index}`,
        type: "cta",
        value: normalized,
        normalized_value: {
          intent,
          destination_url: block.nearby_links.find((link) => link.text === text)?.url ?? null,
          priority: rolePriority(block.role) + index / 10,
        },
        source_block_id: block.id,
        source_url: block.final_url,
        evidence_text: block.text.slice(0, 220),
        context_role: block.role,
        confidence: productCta && !rejected ? "high" : "low",
        confidence_score: productCta && !rejected ? Math.max(0.72, 0.95 - rolePriority(block.role) * 0.05) : 0.25,
        accepted: productCta && !rejected,
        rejection_reason: rejected ? "utility_or_legal_cta" : productCta ? null : "unknown_cta_intent",
      });
    });
  });

  return entities.sort((a, b) => (a.normalized_value?.priority ?? 99) - (b.normalized_value?.priority ?? 99));
}
