import type { Database, PageType } from "@/lib/database.types";

const trackingParams = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "wbraid",
]);

const defaultPages: Array<{ pageType: PageType; path: string }> = [
  { pageType: "homepage", path: "/" },
  { pageType: "pricing", path: "/pricing" },
  { pageType: "features", path: "/features" },
  { pageType: "changelog", path: "/changelog" },
];

export type ParsedCompetitorUrl = {
  baseUrl: string;
  submittedUrl: string;
  submittedPageUrl?: string;
};

function stripTrackingParams(url: URL) {
  const paramsToDelete: string[] = [];

  url.searchParams.forEach((_, key) => {
    const normalizedKey = key.toLowerCase();

    if (normalizedKey.startsWith("utm_") || trackingParams.has(normalizedKey)) {
      paramsToDelete.push(key);
    }
  });

  paramsToDelete.forEach((key) => url.searchParams.delete(key));
  url.searchParams.sort();
}

function normalizePathname(url: URL) {
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
}

function hasSubpage(url: URL) {
  return url.pathname !== "/" || url.search.length > 0;
}

export function parseCompetitorUrl(input: string): ParsedCompetitorUrl {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Competitor URL is required.");
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(candidate);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported URL protocol.");
  }

  if (!url.hostname || url.username || url.password) {
    throw new Error("Enter a valid website URL.");
  }

  url.hash = "";
  normalizePathname(url);
  stripTrackingParams(url);

  const baseUrl = url.origin;
  const submittedUrl = url.toString();

  return {
    baseUrl,
    submittedUrl,
    ...(hasSubpage(url) ? { submittedPageUrl: submittedUrl } : {}),
  };
}

export function normalizeBaseUrl(input: string) {
  return parseCompetitorUrl(input).baseUrl;
}

export function createDefaultMonitoredPages(
  competitorId: string,
  baseUrl: string,
): Array<Database["public"]["Tables"]["monitored_pages"]["Insert"]> {
  return defaultPages.map(({ pageType, path }) => ({
    competitor_id: competitorId,
    page_type: pageType,
    url: new URL(path, baseUrl)
      .toString()
      .replace(/\/$/, path === "/" ? "/" : ""),
  }));
}
