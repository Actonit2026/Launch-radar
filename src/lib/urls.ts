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

const blockedPrivateHostnames = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",
]);
const privateHostPattern =
  /^(?:localhost|0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|::1$|::$|::ffff:127\.|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:|ff[0-9a-f]{2}:)/i;

const blockedCrawlPathPattern =
  /\/(?:login|log-in|signin|sign-in|signup|sign-up|auth|account|checkout|cart|billing-portal|admin|dashboard)(?:\/|$)/i;

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

function serializeNormalizedUrl(url: URL) {
  const value = url.toString();

  return url.pathname === "/" ? value.replace(/\/(?=\?|$)/, "") : value;
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

function unsafeLocalUrlsAllowedForTests() {
  return process.env.LAUNCHRADAR_ALLOW_LOCAL_TEST_URLS === "1";
}

function assertSafePublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  const unbracketed = normalized.replace(/^\[|\]$/g, "");

  if (unsafeLocalUrlsAllowedForTests()) {
    return;
  }

  if (
    !normalized ||
    blockedPrivateHostnames.has(normalized) ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    privateHostPattern.test(unbracketed)
  ) {
    throw new Error("Enter a public website URL.");
  }
}

function assertSafePublicHttpsUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();

  if (url.protocol !== "https:" && !unsafeLocalUrlsAllowedForTests()) {
    throw new Error("LaunchRadar can only scan public HTTPS URLs.");
  }

  if (!hostname || url.username || url.password) {
    throw new Error("Enter a valid website URL.");
  }

  assertSafePublicHostname(hostname);
}

export function normaliseUrl(input: string, baseUrl?: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("URL is required.");
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);

  if (
    hasScheme &&
    !/^https:\/\//i.test(trimmed) &&
    !(unsafeLocalUrlsAllowedForTests() && /^http:\/\//i.test(trimmed))
  ) {
    throw new Error("LaunchRadar can only scan public HTTPS URLs.");
  }

  const candidate = hasScheme
    ? trimmed
    : baseUrl && trimmed.startsWith("/")
      ? new URL(trimmed, baseUrl).toString()
      : `https://${trimmed}`;
  const url = new URL(candidate, baseUrl);

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  normalizePathname(url);
  stripTrackingParams(url);
  assertSafePublicHttpsUrl(url);

  return serializeNormalizedUrl(url);
}

export const normalizeUrl = normaliseUrl;

export function isBlockedCrawlPath(url: string) {
  try {
    return blockedCrawlPathPattern.test(new URL(url).pathname);
  } catch {
    return true;
  }
}

export function parseCompetitorUrl(input: string): ParsedCompetitorUrl {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Competitor URL is required.");
  }

  const submittedUrl = normaliseUrl(trimmed);
  const url = new URL(submittedUrl);

  if (isBlockedCrawlPath(url.toString())) {
    throw new Error("Use a public marketing, product, pricing, docs, or update page.");
  }

  const baseUrl = serializeNormalizedUrl(new URL(url.origin));

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
    : /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : trimmed.includes(".")
        ? `https://${trimmed}`
        : new URL(trimmed.replace(/^\/+/, ""), baseUrl).toString();
  const normalizedPageUrl = normaliseUrl(candidate, baseUrl);
  const pageUrl = new URL(normalizedPageUrl);
  const base = new URL(baseUrl);

  if (normalizeHost(pageUrl.hostname) !== normalizeHost(base.hostname)) {
    throw new Error("Manual pages must be on the competitor domain.");
  }

  if (isBlockedCrawlPath(normalizedPageUrl)) {
    throw new Error("Manual pages must be public pages, not login, account, checkout, or dashboard pages.");
  }

  return normalizedPageUrl;
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
