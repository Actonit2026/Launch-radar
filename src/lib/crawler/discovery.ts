import type { PageType } from "@/lib/database.types";
import { scrapePages, type ScrapedPage } from "@/lib/crawler/scraper";
import { createDefaultMonitoredPages } from "@/lib/urls";

type PageCandidate = {
  pageType: PageType;
  paths: string[];
};

export type DiscoveredPage = {
  pageType: PageType;
  url: string;
  scrape: ScrapedPage;
};

const candidates: PageCandidate[] = [
  { pageType: "homepage", paths: ["/"] },
  { pageType: "pricing", paths: ["/pricing"] },
  { pageType: "features", paths: ["/features", "/product"] },
  {
    pageType: "changelog",
    paths: ["/changelog", "/blog", "/updates", "/release-notes"],
  },
];

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function buildCandidateUrl(baseUrl: string, candidatePath: string) {
  return new URL(candidatePath, baseUrl).toString();
}

function isUsableScrape(scrape: ScrapedPage, pageType: PageType) {
  const minimumLength = pageType === "homepage" ? 40 : 80;

  return scrape.ok && scrape.rawText.length >= minimumLength;
}

export function getCandidateUrls(baseUrl: string) {
  return unique(
    candidates.flatMap((candidate) =>
      candidate.paths.map((candidatePath) =>
        buildCandidateUrl(baseUrl, candidatePath),
      ),
    ),
  );
}

export async function discoverCompetitorPages(baseUrl: string) {
  const urls = getCandidateUrls(baseUrl);
  const scrapedPages = await scrapePages(urls);
  const scrapedByUrl = new Map(
    scrapedPages.map((scrape) => [scrape.requestedUrl, scrape]),
  );
  const discovered: DiscoveredPage[] = [];

  for (const candidate of candidates) {
    const scrape = candidate.paths
      .map((candidatePath) =>
        scrapedByUrl.get(buildCandidateUrl(baseUrl, candidatePath)),
      )
      .find(
        (candidateScrape): candidateScrape is ScrapedPage => {
          if (!candidateScrape) {
            return false;
          }

          return isUsableScrape(candidateScrape, candidate.pageType);
        },
      );

    if (scrape) {
      discovered.push({
        pageType: candidate.pageType,
        url: scrape.finalUrl,
        scrape,
      });
    }
  }

  return discovered;
}

export function defaultDiscoveredPages(competitorId: string, baseUrl: string) {
  return createDefaultMonitoredPages(competitorId, baseUrl).map((page) => ({
    pageType: page.page_type,
    url: page.url,
  }));
}
