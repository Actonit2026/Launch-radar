import * as cheerio from "cheerio";
import { fetchPage, buildFixturePage } from "@/lib/analyzer-v3/fetch/fetchPage";
import { renderPage } from "@/lib/analyzer-v3/fetch/renderPage";
import { classifyPageType } from "@/lib/analyzer-v3/page/classifyPageType";
import { segmentDom } from "@/lib/analyzer-v3/blocks/segmentDom";
import { buildAnalyzerUrl } from "@/lib/analyzer-v3/url/normalizeUrl";
import { validateAnalyzerUrl } from "@/lib/analyzer-v3/url/validateUrl";
import type {
  AnalyzerV3FixturePage,
  AnalyzerV3PageType,
  FetchPageResult,
  PageBundle,
  PageBundlePage,
} from "@/lib/analyzer-v3/types";

const pricingKeywords =
  /\b(?:pricing|price|plans?|pricing-plans|packages?|subscribe|subscription|upgrade|billing|tarifs?|prix)\b/i;
const featuresKeywords =
  /\b(?:features?|product|platform|solutions?|use cases?|capabilities)\b/i;
const changelogKeywords =
  /\b(?:changelog|updates?|release notes?|releases?|what'?s new)\b/i;
const excludedPath =
  /\/(?:login|signin|sign-in|signup|sign-up|auth|account|checkout|cart|billing-portal|admin|dashboard)(?:\/|$)/i;

function sameDomain(url: string, origin: string) {
  return new URL(url).hostname.replace(/^www\./, "") === new URL(origin).hostname.replace(/^www\./, "");
}

function cleanLinkUrl(href: string, baseUrl: string) {
  const url = new URL(href, baseUrl);

  url.hash = "";
  return validateAnalyzerUrl(url.toString()).canonical_url;
}

export function extractHomepageLinks(html: string, baseUrl: string) {
  const $ = cheerio.load(html || "<html><body></body></html>");
  const origin = new URL(baseUrl).origin;
  const links: Array<{ url: string; text: string; source: string }> = [];
  const rejected: Array<{ url: string; reason: string }> = [];
  const seen = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    const text = ($(element).text() || $(element).attr("aria-label") || "").replace(/\s+/g, " ").trim();

    if (!href || href.startsWith("#") || /^(?:mailto|tel|javascript):/i.test(href)) {
      return;
    }

    try {
      const url = cleanLinkUrl(href, baseUrl);

      if (!sameDomain(url, origin)) {
        rejected.push({ url, reason: "external_domain" });
        return;
      }

      if (excludedPath.test(new URL(url).pathname)) {
        rejected.push({ url, reason: "excluded_path" });
        return;
      }

      if (seen.has(url)) {
        return;
      }

      seen.add(url);
      links.push({ url, text, source: "homepage_link" });
    } catch {
      rejected.push({ url: href, reason: "invalid_url" });
    }
  });

  return { links: links.slice(0, 80), rejected };
}

function candidateType(link: { url: string; text: string }): AnalyzerV3PageType {
  const signal = `${new URL(link.url).pathname} ${link.text}`;

  if (pricingKeywords.test(signal)) return "pricing";
  if (featuresKeywords.test(signal)) return "features";
  if (changelogKeywords.test(signal)) return "changelog";

  return "unknown";
}

function classifyFetchedPage(
  page: FetchPageResult,
  requestedPageType: AnalyzerV3PageType,
  homepage?: FetchPageResult | null,
): PageBundlePage {
  const blocks = segmentDom({ page, pageType: requestedPageType });
  const pageTypeResult = classifyPageType({
    page,
    requestedPageType,
    blocks,
    homepage,
  });

  return {
    page,
    requested_page_type: requestedPageType,
    page_type_result: pageTypeResult,
  };
}

async function fetchProgressive(url: string) {
  const page = await fetchPage(url);

  if (page.render_required && process.env.ANALYZER_V3_RENDER_ENABLED === "true") {
    const rendered = await renderPage(url).catch(() => null);
    return rendered?.html ? rendered : page;
  }

  return page;
}

function emptyBundle(): PageBundle {
  return {
    homepage: null,
    pricing_candidates: [],
    optional_pages: [],
    blocked_pages: [],
    missing_pages: [],
    duplicate_pages: [],
    discovered_links: [],
    rejected_links: [],
  };
}

export async function fetchPageBundle(inputUrl: string): Promise<PageBundle> {
  const normalized = validateAnalyzerUrl(inputUrl);
  const origin = normalized.canonical_origin;
  const bundle = emptyBundle();
  const homepagePage = await fetchProgressive(origin);
  const homepage = classifyFetchedPage(homepagePage, "homepage");

  bundle.homepage = homepage;

  if (homepagePage.blocked) bundle.blocked_pages.push(homepage);
  if (homepagePage.status_code === 404 || homepagePage.status_code === 410) bundle.missing_pages.push(homepage);

  const { links, rejected } = extractHomepageLinks(homepagePage.html, origin);
  bundle.discovered_links = links;
  bundle.rejected_links = rejected;

  const submittedPath = new URL(normalized.canonical_url).pathname;
  const candidateLinks = [
    ...(submittedPath && submittedPath !== "/" ? [{ url: normalized.canonical_url, text: "submitted_url", source: "submitted_url" }] : []),
    ...links.filter((link) => candidateType(link) === "pricing"),
    { url: buildAnalyzerUrl(origin, "/pricing"), text: "pricing", source: "fallback_path" },
    { url: buildAnalyzerUrl(origin, "/plans"), text: "plans", source: "fallback_path" },
    { url: buildAnalyzerUrl(origin, "/pricing-plans"), text: "pricing plans", source: "fallback_path" },
  ];
  const seenPricing = new Set<string>();

  for (const link of candidateLinks) {
    if (seenPricing.has(link.url) || link.url === origin) {
      continue;
    }

    seenPricing.add(link.url);
    const fetched = await fetchProgressive(link.url);
    const classified = classifyFetchedPage(fetched, "pricing", homepagePage);

    if (classified.page_type_result.detected_page_type === "duplicate_homepage") {
      bundle.duplicate_pages.push(classified);
    } else if (fetched.blocked) {
      bundle.blocked_pages.push(classified);
    } else if (fetched.status_code === 404 || fetched.status_code === 410 || !fetched.html) {
      bundle.missing_pages.push(classified);
    }

    bundle.pricing_candidates.push(classified);

    if (
      classified.page_type_result.detected_page_type === "pricing" &&
      classified.page_type_result.extraction_allowed
    ) {
      break;
    }
  }

  for (const type of ["features", "changelog"] as const) {
    const link = links.find((item) => candidateType(item) === type);

    if (!link) {
      continue;
    }

    const fetched = await fetchProgressive(link.url);
    const classified = classifyFetchedPage(fetched, type, homepagePage);
    bundle.optional_pages.push(classified);

    if (classified.page_type_result.detected_page_type === "duplicate_homepage") {
      bundle.duplicate_pages.push(classified);
    }
  }

  return bundle;
}

export function fixturePageBundle({
  inputUrl,
  pages,
}: {
  inputUrl: string;
  pages: AnalyzerV3FixturePage[];
}): PageBundle {
  const normalized = validateAnalyzerUrl(inputUrl);
  const bundle = emptyBundle();
  const built = pages.map((fixture) => ({
    requested: fixture.requested_page_type,
    page: buildFixturePage({
      url: validateAnalyzerUrl(fixture.url).canonical_url,
      html: fixture.html,
      statusCode: fixture.status_code ?? 200,
      contentType: fixture.content_type,
    }),
  }));
  const homepagePage =
    built.find((item) => item.requested === "homepage")?.page ??
    buildFixturePage({ url: normalized.canonical_origin, html: "", statusCode: 404 });
  const homepage = classifyFetchedPage(homepagePage, "homepage");

  bundle.homepage = homepage;

  for (const item of built) {
    const classified = classifyFetchedPage(item.page, item.requested, homepagePage);

    if (item.requested === "homepage") {
      bundle.homepage = classified;
    } else if (item.requested === "pricing") {
      bundle.pricing_candidates.push(classified);
    } else {
      bundle.optional_pages.push(classified);
    }

    if (classified.page_type_result.detected_page_type === "duplicate_homepage") {
      bundle.duplicate_pages.push(classified);
    }

    if (classified.page.blocked) {
      bundle.blocked_pages.push(classified);
    }

    if (classified.page.status_code === 404 || classified.page.status_code === 410 || !classified.page.html) {
      bundle.missing_pages.push(classified);
    }
  }

  const homepageLinks = extractHomepageLinks(homepagePage.html, normalized.canonical_origin);
  bundle.discovered_links = homepageLinks.links;
  bundle.rejected_links = homepageLinks.rejected;

  return bundle;
}
