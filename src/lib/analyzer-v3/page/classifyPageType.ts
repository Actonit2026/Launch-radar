import { isDuplicateHomepage } from "@/lib/analyzer-v3/page/detectDuplicatePage";
import type {
  AnalyzerV3PageType,
  EvidenceBlock,
  FetchPageResult,
  PageTypeResult,
} from "@/lib/analyzer-v3/types";

function pathSignals(url: string) {
  const path = new URL(url).pathname.toLowerCase();

  if (/\/(?:pricing|plans|pricing-plans|packages?|subscribe|upgrade)(?:\/|$)/.test(path)) return "pricing";
  if (/\/(?:features?|product|platform|solutions?|use-cases?)(?:\/|$)/.test(path)) return "features";
  if (/\/(?:changelog|updates?|release-notes?|releases?)(?:\/|$)/.test(path)) return "changelog";
  if (/\/(?:docs?|help|support|api)(?:\/|$)/.test(path)) return "docs";
  if (/\/(?:blog|articles?|resources?)(?:\/|$)/.test(path)) return "blog";
  if (/\/(?:customers?|case-stud(?:y|ies)|stories)(?:\/|$)/.test(path)) return "case_study";
  if (/\/(?:login|signin|sign-in|account|dashboard)(?:\/|$)/.test(path)) return "login";
  if (/\/(?:checkout|cart)(?:\/|$)/.test(path)) return "checkout";
  if (path === "/" || path === "") return "homepage";

  return "unknown";
}

function contentSignals(page: FetchPageResult, blocks: EvidenceBlock[]) {
  const text = `${page.title}\n${page.meta_description}\n${page.text}`.toLowerCase();
  const roles = new Set(blocks.map((block) => block.role));

  if (roles.has("pricing_table") || roles.has("pricing_card") || /\b(?:pricing|plans|billing|starter|enterprise|contact sales)\b/.test(text) && /[$\u20ac\u00a3]\s?\d|\b(?:usd|eur|gbp)\s?\d/.test(text)) return "pricing";
  if (roles.has("changelog_entry") || roles.has("release_note") || /\b(?:changelog|release notes|shipped|fixed|improved|version)\b/.test(text)) return "changelog";
  if (roles.has("feature_grid") || roles.has("feature_card") || /\b(?:features|capabilities|integrations|workflow|platform)\b/.test(text)) return "features";
  if (roles.has("blog_content") || /\b(?:blog|article|published by|read more)\b/.test(text)) return "blog";
  if (roles.has("case_study") || /\b(?:case study|customer story)\b/.test(text)) return "case_study";
  if (roles.has("hero") || /\b(?:sign up|get started|book a demo)\b/.test(text)) return "homepage";

  return "unknown";
}

function pageTypeMatchesRequested(requested: AnalyzerV3PageType, detected: AnalyzerV3PageType) {
  if (requested === detected) return true;
  if (requested === "features" && detected === "homepage") return false;
  if (requested === "pricing" && detected === "homepage") return false;
  if (requested === "changelog" && detected === "homepage") return false;
  if (requested === "homepage" && ["features", "pricing", "changelog"].includes(detected)) return true;

  return requested === "unknown" && detected !== "blocked" && detected !== "missing";
}

export function classifyPageType({
  page,
  requestedPageType,
  blocks,
  homepage,
}: {
  page: FetchPageResult;
  requestedPageType: AnalyzerV3PageType;
  blocks: EvidenceBlock[];
  homepage?: FetchPageResult | null;
}): PageTypeResult {
  const reasons: string[] = [];

  if (page.blocked) {
    return {
      requested_page_type: requestedPageType,
      detected_page_type: "blocked",
      confidence: 0.95,
      reasons: ["fetch_blocked"],
      duplicate_of: null,
      extraction_allowed: false,
    };
  }

  if (page.status_code === 404 || page.status_code === 410 || !page.html) {
    return {
      requested_page_type: requestedPageType,
      detected_page_type: "missing",
      confidence: 0.95,
      reasons: ["missing_or_empty"],
      duplicate_of: null,
      extraction_allowed: false,
    };
  }

  if (requestedPageType !== "homepage" && isDuplicateHomepage(page, homepage)) {
    return {
      requested_page_type: requestedPageType,
      detected_page_type: "duplicate_homepage",
      confidence: 0.96,
      reasons: ["near_duplicate_homepage"],
      duplicate_of: homepage?.final_url ?? null,
      extraction_allowed: false,
    };
  }

  const byPath = pathSignals(page.final_url);
  const byContent = contentSignals(page, blocks);
  let detected: AnalyzerV3PageType = byContent !== "unknown" ? byContent : byPath;
  let confidence = byPath === byContent ? 0.94 : byContent !== "unknown" ? 0.84 : 0.62;

  if (requestedPageType === "homepage" && byPath === "homepage") {
    detected = "homepage";
    confidence = Math.max(confidence, 0.9);
  }

  reasons.push(`url_path:${byPath}`);
  reasons.push(`content:${byContent}`);

  const extractionAllowed =
    page.status_code === null || page.status_code < 400
      ? pageTypeMatchesRequested(requestedPageType, detected)
      : false;

  if (!extractionAllowed) {
    reasons.push("page_type_mismatch_or_unavailable");
  }

  return {
    requested_page_type: requestedPageType,
    detected_page_type: detected,
    confidence,
    reasons,
    duplicate_of: null,
    extraction_allowed: extractionAllowed,
  };
}
