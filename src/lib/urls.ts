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

export const manualPageTypes = [
  "pricing",
  "features",
  "product",
  "changelog",
  "docs",
] as const satisfies readonly PageType[];

export type ManualPageType = (typeof manualPageTypes)[number];

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

function normalizeHost(value: string) {
  return value.toLowerCase().replace(/^www\./, "");
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

export function isManualPageType(value: string): value is ManualPageType {
  return manualPageTypes.includes(value as ManualPageType);
}

export function parseManualPageUrl(input: string, baseUrl: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Page URL is required.");
  }

  const candidate = trimmed.startsWith("/")
    ? new URL(trimmed, baseUrl).toString()
    : /^https?:\/\//i.test(trimmed)
      ? trimmed
      : trimmed.includes(".")
        ? `https://${trimmed}`
        : new URL(trimmed.replace(/^\/+/, ""), baseUrl).toString();
  const pageUrl = new URL(candidate, baseUrl);
  const base = new URL(baseUrl);

  if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") {
    throw new Error("Unsupported URL protocol.");
  }

  if (normalizeHost(pageUrl.hostname) !== normalizeHost(base.hostname)) {
    throw new Error("Manual pages must be on the competitor domain.");
  }

  pageUrl.hash = "";
  normalizePathname(pageUrl);
  stripTrackingParams(pageUrl);

  return pageUrl.toString();
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
