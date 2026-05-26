import type { SafeUrlResult } from "@/lib/analyzer-v3/types";

const trackingParams = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "wbraid",
]);

function hasScheme(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function stripTracking(url: URL) {
  const stripped: string[] = [];

  url.searchParams.forEach((_, key) => {
    const normalizedKey = key.toLowerCase();

    if (normalizedKey.startsWith("utm_") || trackingParams.has(normalizedKey)) {
      stripped.push(key);
    }
  });

  stripped.forEach((key) => url.searchParams.delete(key));
  url.searchParams.sort();

  return stripped;
}

function normalizePath(url: URL) {
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
}

export function serializeAnalyzerUrl(url: URL) {
  const value = url.toString();

  return url.pathname === "/" && !url.search
    ? value.replace(/\/$/, "")
    : value.replace(/\/(?=\?|$)/, "");
}

export function canonicalOrigin(url: URL) {
  return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
}

export function normalizeAnalyzerUrl(input: string): SafeUrlResult {
  const inputUrl = input.trim();

  if (!inputUrl) {
    throw new Error("URL is required.");
  }

  const candidate = hasScheme(inputUrl) ? inputUrl : `https://${inputUrl}`;
  const url = new URL(candidate);

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.username = "";
  url.password = "";
  url.hash = "";
  normalizePath(url);

  const stripped = stripTracking(url);

  return {
    input_url: input,
    canonical_url: serializeAnalyzerUrl(url),
    canonical_origin: canonicalOrigin(url),
    stripped_tracking_params: stripped,
    warnings: stripped.length
      ? [`Stripped tracking parameters: ${stripped.join(", ")}.`]
      : [],
  };
}

export function buildAnalyzerUrl(origin: string, path: string) {
  const url = new URL(path, origin);
  url.hash = "";
  stripTracking(url);
  normalizePath(url);

  return serializeAnalyzerUrl(url);
}
