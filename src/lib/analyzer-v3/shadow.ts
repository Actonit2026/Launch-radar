import { blockRoleCounts } from "@/lib/analyzer-v3/blocks/classifyBlockRole";
import { segmentDom } from "@/lib/analyzer-v3/blocks/segmentDom";
import { fixturePageBundle } from "@/lib/analyzer-v3/fetch/fetchPageBundle";
import { buildBusinessModel } from "@/lib/analyzer-v3/models/buildBusinessModel";
import { validateAnalyzerUrl } from "@/lib/analyzer-v3/url/validateUrl";
import { validateBusinessModelSnapshot } from "@/lib/analyzer-v3/validation/validateSnapshot";
import type { AnalyzerV3PageType } from "@/lib/analyzer-v3/types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type { PageType } from "@/lib/database.types";

function toAnalyzerPageType(pageType: PageType): AnalyzerV3PageType {
  if (pageType === "homepage") return "homepage";
  if (pageType === "pricing") return "pricing";
  if (pageType === "features" || pageType === "product") return "features";
  if (pageType === "changelog") return "changelog";
  if (pageType === "docs") return "docs";
  return "unknown";
}

export function analyzeScrapedPagesV3({
  inputUrl,
  pages,
}: {
  inputUrl: string;
  pages: Array<{
    pageType: PageType;
    scrape: Pick<ScrapedPage, "finalUrl" | "html" | "status">;
  }>;
}) {
  const usable = pages.filter((page) => page.scrape.html !== undefined);

  if (!usable.length) {
    return null;
  }

  const bundle = fixturePageBundle({
    inputUrl,
    pages: usable.map((page) => ({
      url: page.scrape.finalUrl,
      requested_page_type: toAnalyzerPageType(page.pageType),
      html: page.scrape.html ?? "",
      status_code: page.scrape.status ?? 200,
    })),
  });
  const normalized = validateAnalyzerUrl(inputUrl);
  const bundlePages = [
    ...(bundle.homepage ? [bundle.homepage] : []),
    ...bundle.pricing_candidates,
    ...bundle.optional_pages,
  ];
  const blocks = bundlePages.flatMap((page) =>
    page.page_type_result.extraction_allowed
      ? segmentDom({
          page: page.page,
          pageType: page.page_type_result.detected_page_type,
        })
      : [],
  );
  const model = buildBusinessModel({ bundle, blocks });
  const validation = validateBusinessModelSnapshot(model.businessModel);

  return {
    analyzer_version: "v3" as const,
    input_url: inputUrl,
    canonical_url: normalized.canonical_url,
    fetch_summary: {
      homepage_status: bundle.homepage?.page_type_result.extraction_allowed
        ? "verified" as const
        : bundle.homepage?.page.blocked
          ? "blocked" as const
          : "partial" as const,
      pages_attempted: bundlePages.length,
      pages_fetched: bundlePages.filter((page) => page.page.status_code !== null && page.page.status_code < 400).length,
      blocked_pages: bundle.blocked_pages.length,
      missing_pages: bundle.missing_pages.length,
    },
    pages: bundlePages,
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
