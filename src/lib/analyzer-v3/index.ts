import { blockRoleCounts } from "@/lib/analyzer-v3/blocks/classifyBlockRole";
import { segmentDom } from "@/lib/analyzer-v3/blocks/segmentDom";
import { fetchPageBundle, fixturePageBundle } from "@/lib/analyzer-v3/fetch/fetchPageBundle";
import { buildBusinessModel } from "@/lib/analyzer-v3/models/buildBusinessModel";
import { validateAnalyzerUrl } from "@/lib/analyzer-v3/url/validateUrl";
import { validateBusinessModelSnapshot } from "@/lib/analyzer-v3/validation/validateSnapshot";
import type {
  AnalyzerV3FixturePage,
  AnalyzerV3Result,
  EvidenceBlock,
  PageBundle,
  PageBundlePage,
} from "@/lib/analyzer-v3/types";

export function analyzerV3Enabled() {
  return process.env.ENABLE_ANALYZER_V3 === "true";
}

export function analyzerV3ShadowMode() {
  return process.env.ANALYZER_V3_SHADOW_MODE === "true";
}

function allBundlePages(bundle: PageBundle) {
  return [
    ...(bundle.homepage ? [bundle.homepage] : []),
    ...bundle.pricing_candidates,
    ...bundle.optional_pages,
  ];
}

function blocksForPages(pages: PageBundlePage[]) {
  const blocks: EvidenceBlock[] = [];

  pages.forEach((page) => {
    if (!page.page_type_result.extraction_allowed) {
      return;
    }

    blocks.push(
      ...segmentDom({
        page: page.page,
        pageType: page.page_type_result.detected_page_type,
      }),
    );
  });

  return blocks;
}

function fetchSummary(bundle: PageBundle) {
  const pages = allBundlePages(bundle);

  return {
    homepage_status: bundle.homepage?.page_type_result.extraction_allowed
      ? "verified" as const
      : bundle.homepage?.page.blocked
        ? "blocked" as const
        : "partial" as const,
    pages_attempted: pages.length,
    pages_fetched: pages.filter((page) => page.page.status_code !== null && page.page.status_code < 400).length,
    blocked_pages: bundle.blocked_pages.length,
    missing_pages: bundle.missing_pages.length,
  };
}

export function analyzePageBundleV3({
  inputUrl,
  bundle,
}: {
  inputUrl: string;
  bundle: PageBundle;
}): AnalyzerV3Result {
  const normalized = validateAnalyzerUrl(inputUrl);
  const pages = allBundlePages(bundle);
  const blocks = blocksForPages(pages);
  const model = buildBusinessModel({ bundle, blocks });
  const validation = validateBusinessModelSnapshot(model.businessModel);

  return {
    analyzer_version: "v3",
    input_url: inputUrl,
    canonical_url: normalized.canonical_url,
    fetch_summary: fetchSummary(bundle),
    pages,
    blocks,
    business_model: model.businessModel,
    rejected_entities: model.rejectedEntities,
    validity: validation.validity,
    confidence: model.businessModel.confidence,
    completeness: model.businessModel.completeness,
    warnings: [
      ...normalized.warnings,
      ...model.businessModel.warnings,
      ...validation.reasons.map((reason) => `Validation: ${reason}`),
    ],
    debug_admin_only: {
      normalized_url: normalized,
      page_bundle: bundle,
      block_role_counts: blockRoleCounts(blocks),
      accepted_entities: model.acceptedEntities,
      rejected_entities: model.rejectedEntities,
      model_validation: validation,
    },
  };
}

export async function analyzeUrlV3(inputUrl: string) {
  const bundle = await fetchPageBundle(inputUrl);
  return analyzePageBundleV3({ inputUrl, bundle });
}

export function analyzeFixtureV3({
  inputUrl,
  pages,
}: {
  inputUrl: string;
  pages: AnalyzerV3FixturePage[];
}) {
  const bundle = fixturePageBundle({ inputUrl, pages });
  return analyzePageBundleV3({ inputUrl, bundle });
}

export { compareBusinessModels } from "@/lib/analyzer-v3/compare/compareBusinessModels";
export { analyzeScrapedPagesV3 } from "@/lib/analyzer-v3/shadow";
export { buildAnalyzerUrl, normalizeAnalyzerUrl } from "@/lib/analyzer-v3/url/normalizeUrl";
export { validateAnalyzerUrl } from "@/lib/analyzer-v3/url/validateUrl";
export type * from "@/lib/analyzer-v3/types";
