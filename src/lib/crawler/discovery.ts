import * as cheerio from "cheerio";
import { crawlerUserAgent } from "@/lib/crawler/robots";
import type { PageType } from "@/lib/database.types";
import { scrapePages, type ScrapedPage } from "@/lib/crawler/scraper";
import { createDefaultMonitoredPages, isBlockedCrawlPath } from "@/lib/urls";

type CandidatePageType = PageType | "product" | "docs" | "unknown";
type CandidateSource =
  | "homepage"
  | "submitted"
  | "homepage_link"
  | "sitemap"
  | "fallback";

type PageCandidate = {
  url: string;
  source: CandidateSource;
  linkText?: string;
};

type DiscoveryOptions = {
  submittedPageUrl?: string;
};

type ClassifiedCandidate = PageCandidate & {
  pageType: CandidatePageType;
  relevanceScore: number;
};

export type DiscoveredPage = {
  pageType: PageType;
  candidatePageType: CandidatePageType;
  url: string;
  title: string;
  relevanceScore: number;
  fetchStatus: number | null;
  contentHash: string;
  extractedTextLength: number;
  source: CandidateSource;
  scrape: ScrapedPage;
};

const sitemapTimeoutMs = 8000;

const fallbackPaths = [
  "/",
  "/pricing",
  "/plans",
  "/packages",
  "/subscription",
  "/billing",
  "/tarifs",
  "/prix",
  "/features",
  "/product",
  "/platform",
  "/solutions",
  "/use-cases",
  "/changelog",
  "/updates",
  "/release-notes",
  "/releases",
  "/docs",
  "/help",
  "/support",
  "/api",
];

const excludedPathPattern =
  /\/(?:login|log-in|signin|sign-in|signup|sign-up|auth|account|checkout|cart|privacy|terms|legal|careers|jobs)(?:\/|$)/i;

const keywordGroups: Record<Exclude<CandidatePageType, "homepage">, string[]> =
  {
    pricing: [
      "pricing",
      "plans",
      "packages",
      "subscription",
      "billing",
      "tarifs",
      "prix",
    ],
    features: ["features", "solutions", "use-cases", "use cases"],
    product: ["product", "platform"],
    changelog: ["changelog", "updates", "release-notes", "release notes", "releases"],
    docs: ["docs", "help", "support", "api"],
    unknown: [],
  };

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function normalizeHost(value: string) {
  return value.toLowerCase().replace(/^www\./, "");
}

function sameSite(url: string, baseUrl: string) {
  try {
    return (
      normalizeHost(new URL(url).hostname) ===
      normalizeHost(new URL(baseUrl).hostname)
    );
  } catch {
    return false;
  }
}

function canonicalizeUrl(url: string, baseUrl?: string) {
  const parsed = new URL(url, baseUrl);

  parsed.hash = "";

  if (parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

function isExcludedCandidate(url: string) {
  try {
    const parsed = new URL(url);

    return excludedPathPattern.test(parsed.pathname) || isBlockedCrawlPath(url);
  } catch {
    return true;
  }
}

function maxInitialCandidatePages() {
  const value = Number(process.env.MAX_PAGES_PER_SCAN);

  return Number.isFinite(value) && value > 0 ? Math.min(value, 30) : 15;
}

function addCandidate(
  candidates: Map<string, PageCandidate>,
  candidate: PageCandidate,
  baseUrl: string,
) {
  if (!sameSite(candidate.url, baseUrl) || isExcludedCandidate(candidate.url)) {
    return;
  }

  const canonicalUrl = canonicalizeUrl(candidate.url);
  const existing = candidates.get(canonicalUrl);

  if (!existing || sourcePriority(candidate.source) > sourcePriority(existing.source)) {
    candidates.set(canonicalUrl, {
      ...candidate,
      url: canonicalUrl,
    });
  }
}

function sourcePriority(source: CandidateSource) {
  switch (source) {
    case "submitted":
      return 5;
    case "homepage":
      return 4;
    case "homepage_link":
      return 3;
    case "sitemap":
      return 2;
    default:
      return 1;
  }
}

function sourceBaseScore(source: CandidateSource) {
  switch (source) {
    case "submitted":
      return 60;
    case "homepage":
      return 55;
    case "homepage_link":
      return 16;
    case "sitemap":
      return 10;
    default:
      return 4;
  }
}

function keywordHits(value: string, keywords: string[]) {
  const haystack = value.toLowerCase();

  return keywords.filter((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  ).length;
}

function classifyCandidate(
  candidate: PageCandidate,
  scrape?: ScrapedPage,
): CandidatePageType {
  const url = new URL(candidate.url);

  if (url.pathname === "/" || url.pathname === "") {
    return "homepage";
  }

  const urlText = `${url.pathname} ${url.search}`.toLowerCase();
  const supportingText = [
    candidate.linkText ?? "",
    scrape?.title ?? "",
    scrape?.metaDescription ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const scoredTypes = (
    Object.keys(keywordGroups) as Array<Exclude<CandidatePageType, "homepage">>
  )
    .filter((pageType) => pageType !== "unknown")
    .map((pageType) => ({
      pageType,
      score:
        keywordHits(urlText, keywordGroups[pageType]) * 4 +
        keywordHits(supportingText, keywordGroups[pageType]) * 2,
    }))
    .sort((a, b) => b.score - a.score);

  return scoredTypes[0]?.score ? scoredTypes[0].pageType : "unknown";
}

function relevanceScore(candidate: PageCandidate, scrape?: ScrapedPage) {
  const pageType = classifyCandidate(candidate, scrape);
  const url = new URL(candidate.url);
  const urlText = `${url.pathname} ${url.search}`;
  const supportingText = [
    candidate.linkText ?? "",
    scrape?.title ?? "",
    scrape?.metaDescription ?? "",
  ].join(" ");
  const keywordScore =
    pageType === "homepage" || pageType === "unknown"
      ? 0
      : keywordHits(urlText, keywordGroups[pageType]) * 14 +
        keywordHits(supportingText, keywordGroups[pageType]) * 7;
  const successfulFetchScore = scrape?.ok ? 8 : 0;
  const usefulTextScore = Math.min(
    Math.floor((scrape?.rawText.length ?? 0) / 400),
    8,
  );

  return (
    sourceBaseScore(candidate.source) +
    keywordScore +
    successfulFetchScore +
    usefulTextScore
  );
}

function classifyAndScore(
  candidate: PageCandidate,
  scrape?: ScrapedPage,
): ClassifiedCandidate {
  return {
    ...candidate,
    pageType: classifyCandidate(candidate, scrape),
    relevanceScore: relevanceScore(candidate, scrape),
  };
}

function storagePageType(pageType: CandidatePageType): PageType | null {
  switch (pageType) {
    case "homepage":
    case "pricing":
    case "features":
    case "product":
    case "changelog":
    case "docs":
      return pageType;
    default:
      return null;
  }
}

function isUsableScrape(scrape: ScrapedPage, pageType: PageType) {
  const minimumLength = pageType === "homepage" ? 40 : 80;

  return scrape.ok && scrape.rawText.length >= minimumLength;
}

function fallbackCandidates(baseUrl: string) {
  return fallbackPaths.map((path) => ({
    url: canonicalizeUrl(path, baseUrl),
    source: path === "/" ? ("homepage" as const) : ("fallback" as const),
  }));
}

function homepageLinkCandidates(homepage: ScrapedPage, baseUrl: string) {
  return homepage.links.map((link) => ({
    url: link.url,
    linkText: link.text,
    source: "homepage_link" as const,
  })).filter((candidate) => sameSite(candidate.url, baseUrl));
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sitemapTimeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "application/xml,text/xml,text/plain",
        "user-agent": crawlerUserAgent(),
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseSitemapUrls(xml: string) {
  const $ = cheerio.load(xml, { xmlMode: true });

  return $("loc")
    .map((_, element) => $(element).text().trim())
    .get()
    .filter(Boolean);
}

async function sitemapCandidates(baseUrl: string) {
  const sitemapUrls = ["/sitemap.xml", "/sitemap_index.xml"].map((path) =>
    canonicalizeUrl(path, baseUrl),
  );
  const discoveredUrls: string[] = [];

  for (const sitemapUrl of sitemapUrls) {
    const xml = await fetchText(sitemapUrl);

    if (!xml) {
      continue;
    }

    const locs = parseSitemapUrls(xml);
    const nestedSitemaps = locs
      .filter((url) => /sitemap.*\.xml(?:\?|$)/i.test(url))
      .slice(0, 3);

    discoveredUrls.push(...locs.filter((url) => !/\.xml(?:\?|$)/i.test(url)));

    for (const nestedSitemap of nestedSitemaps) {
      if (!sameSite(nestedSitemap, baseUrl)) {
        continue;
      }

      const nestedXml = await fetchText(nestedSitemap);

      if (nestedXml) {
        discoveredUrls.push(...parseSitemapUrls(nestedXml));
      }
    }
  }

  return unique(discoveredUrls)
    .filter((url) => sameSite(url, baseUrl))
    .map((url) => ({
      url,
      source: "sitemap" as const,
    }));
}

function scrapeForCandidate(
  candidate: PageCandidate,
  scrapes: Map<string, ScrapedPage>,
) {
  return scrapes.get(candidate.url);
}

function selectCandidatesToScrape(candidates: PageCandidate[]) {
  const ranked = candidates
    .map((candidate) => classifyAndScore(candidate))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  const required = ranked.filter(
    (candidate) =>
      candidate.source === "homepage" || candidate.source === "submitted",
  );
  const selected = unique([
    ...required.map((candidate) => candidate.url),
    ...ranked.map((candidate) => candidate.url),
  ]).slice(0, maxInitialCandidatePages());

  return selected
    .map((url) => candidates.find((candidate) => candidate.url === url))
    .filter((candidate): candidate is PageCandidate => Boolean(candidate));
}

function bestDiscoveredPages(
  candidates: PageCandidate[],
  scrapedByUrl: Map<string, ScrapedPage>,
) {
  const bestByPageType = new Map<PageType, DiscoveredPage>();

  for (const candidate of candidates) {
    const scrape = scrapeForCandidate(candidate, scrapedByUrl);

    if (!scrape) {
      continue;
    }

    const classified = classifyAndScore(candidate, scrape);
    const pageType = storagePageType(classified.pageType);

    if (!pageType || !isUsableScrape(scrape, pageType)) {
      continue;
    }

    const discovered: DiscoveredPage = {
      pageType,
      candidatePageType: classified.pageType,
      url: scrape.finalUrl,
      title: scrape.title,
      relevanceScore: classified.relevanceScore,
      fetchStatus: scrape.status,
      contentHash: scrape.hash,
      extractedTextLength: scrape.rawText.length,
      source: candidate.source,
      scrape,
    };
    const currentBest = bestByPageType.get(pageType);

    if (
      !currentBest ||
      discovered.relevanceScore > currentBest.relevanceScore
    ) {
      bestByPageType.set(pageType, discovered);
    }
  }

  return (
    ["homepage", "pricing", "features", "product", "changelog", "docs"] as PageType[]
  )
    .map((pageType) => bestByPageType.get(pageType))
    .filter((page): page is DiscoveredPage => Boolean(page));
}

export function getCandidateUrls(baseUrl: string, options?: DiscoveryOptions) {
  const candidates = new Map<string, PageCandidate>();

  addCandidate(
    candidates,
    { url: canonicalizeUrl("/", baseUrl), source: "homepage" },
    baseUrl,
  );

  if (options?.submittedPageUrl) {
    addCandidate(
      candidates,
      { url: options.submittedPageUrl, source: "submitted" },
      baseUrl,
    );
  }

  fallbackCandidates(baseUrl).forEach((candidate) =>
    addCandidate(candidates, candidate, baseUrl),
  );

  return selectCandidatesToScrape(Array.from(candidates.values())).map(
    (candidate) => candidate.url,
  );
}

export async function discoverCompetitorPages(
  baseUrl: string,
  options?: DiscoveryOptions,
) {
  const candidates = new Map<string, PageCandidate>();
  const homepageUrl = canonicalizeUrl("/", baseUrl);

  addCandidate(candidates, { url: homepageUrl, source: "homepage" }, baseUrl);

  if (options?.submittedPageUrl) {
    addCandidate(
      candidates,
      { url: options.submittedPageUrl, source: "submitted" },
      baseUrl,
    );
  }

  const seedUrls = Array.from(candidates.values()).map(
    (candidate) => candidate.url,
  );
  const seedScrapes = await scrapePages(seedUrls);
  const scrapedByUrl = new Map(
    seedScrapes.map((scrape) => [scrape.requestedUrl, scrape]),
  );
  const homepageScrape = scrapedByUrl.get(homepageUrl);

  if (homepageScrape?.ok) {
    homepageLinkCandidates(homepageScrape, baseUrl).forEach((candidate) =>
      addCandidate(candidates, candidate, baseUrl),
    );
  }

  const sitemapDiscovered = await sitemapCandidates(baseUrl);
  sitemapDiscovered.forEach((candidate) =>
    addCandidate(candidates, candidate, baseUrl),
  );
  fallbackCandidates(baseUrl).forEach((candidate) =>
    addCandidate(candidates, candidate, baseUrl),
  );

  const selectedCandidates = selectCandidatesToScrape(
    Array.from(candidates.values()),
  );
  const remainingUrls = selectedCandidates
    .map((candidate) => candidate.url)
    .filter((url) => !scrapedByUrl.has(url));
  const remainingScrapes = await scrapePages(remainingUrls);

  for (const scrape of remainingScrapes) {
    scrapedByUrl.set(scrape.requestedUrl, scrape);
  }

  return bestDiscoveredPages(selectedCandidates, scrapedByUrl);
}

export function defaultDiscoveredPages(competitorId: string, baseUrl: string) {
  return createDefaultMonitoredPages(competitorId, baseUrl).map((page) => ({
    pageType: page.page_type,
    url: page.url,
  }));
}
