import type { PageType } from "@/lib/database.types";
import type { ScrapedPage } from "@/lib/crawler/scraper";
import type {
  DetectedPageType,
  PageValidation,
  PageValidationStatus,
} from "@/lib/intelligence/types";

const trackingParams = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "wbraid",
]);

const pageTypeKeywords: Record<
  Exclude<DetectedPageType, "blocked" | "missing" | "duplicate_homepage" | "unknown">,
  RegExp
> = {
  homepage: /\b(?:homepage|home)\b/i,
  pricing: /\b(?:pricing|price|prices|plans?|packages?|subscription|billing|tarifs|prix|choose plan|compare plans)\b/i,
  features: /\b(?:features?|capabilities|integrations?|workflow|automation|platform features)\b/i,
  product: /\b(?:product|platform|solution|use cases?|what it does)\b/i,
  changelog: /\b(?:changelog|updates|release notes?|releases|shipped|fixed|improved|new in)\b/i,
  docs: /\b(?:docs?|documentation|api reference|help center|support center|guides?)\b/i,
  blog: /\b(?:blog|articles?|news|guides?|tutorials?)\b/i,
  case_study: /\b(?:case stud(?:y|ies)|customer stor(?:y|ies)|success stor(?:y|ies))\b/i,
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

export function canonicalAnalyzerUrl(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);

    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    stripTrackingParams(url);
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    const serialized = url.toString();

    return url.pathname === "/" ? serialized.replace(/\/(?=\?|$)/, "") : serialized;
  } catch {
    return value.trim();
  }
}

function rootUrl(value: string) {
  try {
    const url = new URL(value);

    return canonicalAnalyzerUrl(url.origin);
  } catch {
    return canonicalAnalyzerUrl(value);
  }
}

function pathSignal(value: string) {
  try {
    const url = new URL(value);

    return `${url.pathname} ${url.search}`.replace(/[-_/]+/g, " ");
  } catch {
    return value;
  }
}

function scoreType({
  type,
  finalUrl,
  text,
  blockBoost,
}: {
  type: Exclude<DetectedPageType, "blocked" | "missing" | "duplicate_homepage" | "unknown">;
  finalUrl: string;
  text: string;
  blockBoost: number;
}) {
  const urlText = pathSignal(finalUrl);
  const keyword = pageTypeKeywords[type];
  let score = 0;

  if (type === "homepage") {
    try {
      const url = new URL(finalUrl);
      if (url.pathname === "/" || url.pathname === "") {
        score += 0.72;
      }
    } catch {
      // URL parse failures are handled by the unknown fallback.
    }
  }

  if (keyword.test(urlText)) {
    score += 0.45;
  }

  if (keyword.test(text)) {
    score += 0.24;
  }

  return Math.min(0.98, score + blockBoost);
}

function detectContentPageType(scrape: ScrapedPage): {
  type: DetectedPageType;
  confidence: number;
} {
  const model = scrape.pageModel;
  const text = [
    scrape.title,
    scrape.metaDescription,
    model?.h1 ?? "",
    model?.hero?.heading ?? "",
    model?.hero?.text ?? "",
    scrape.rawText.slice(0, 1600),
  ].join("\n");
  const scores = [
    {
      type: "homepage" as const,
      score: scoreType({ type: "homepage", finalUrl: scrape.finalUrl, text, blockBoost: 0 }),
    },
    {
      type: "pricing" as const,
      score: scoreType({
        type: "pricing",
        finalUrl: scrape.finalUrl,
        text,
        blockBoost: model?.pricingBlocks.length ? 0.32 : 0,
      }),
    },
    {
      type: "features" as const,
      score: scoreType({
        type: "features",
        finalUrl: scrape.finalUrl,
        text,
        blockBoost: model?.featureBlocks.length ? 0.28 : 0,
      }),
    },
    {
      type: "product" as const,
      score: scoreType({ type: "product", finalUrl: scrape.finalUrl, text, blockBoost: 0 }),
    },
    {
      type: "changelog" as const,
      score: scoreType({
        type: "changelog",
        finalUrl: scrape.finalUrl,
        text,
        blockBoost: model?.changelogBlocks.length ? 0.34 : 0,
      }),
    },
    {
      type: "docs" as const,
      score: scoreType({ type: "docs", finalUrl: scrape.finalUrl, text, blockBoost: 0 }),
    },
    {
      type: "blog" as const,
      score: scoreType({ type: "blog", finalUrl: scrape.finalUrl, text, blockBoost: 0 }),
    },
    {
      type: "case_study" as const,
      score: scoreType({
        type: "case_study",
        finalUrl: scrape.finalUrl,
        text,
        blockBoost: 0,
      }),
    },
  ].sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (!best || best.score < 0.52) {
    return { type: "unknown", confidence: Number((best?.score ?? 0).toFixed(2)) };
  }

  return { type: best.type, confidence: Number(best.score.toFixed(2)) };
}

function statusForDetectedType(type: DetectedPageType): PageValidationStatus {
  if (type === "blocked") return "blocked";
  if (type === "missing") return "missing";
  if (type === "duplicate_homepage") return "duplicate_homepage";
  if (type === "unknown") return "unknown";

  return "verified";
}

function isMissing(scrape: ScrapedPage) {
  return scrape.status === 404 || scrape.status === 410 || scrape.errorType === "not_found";
}

function isBlocked(scrape: ScrapedPage) {
  return (
    scrape.status === 401 ||
    scrape.status === 403 ||
    scrape.errorType === "blocked" ||
    /blocked|forbidden|robots/i.test(scrape.error ?? "")
  );
}

function isHomepageUrl(value: string) {
  try {
    const url = new URL(value);

    return url.pathname === "/" || url.pathname === "";
  } catch {
    return false;
  }
}

export function validatePageForIntelligence({
  requestedPageType,
  scrape,
  homepageScrape,
}: {
  requestedPageType: PageType;
  scrape: ScrapedPage;
  homepageScrape?: Pick<ScrapedPage, "finalUrl" | "hash" | "rawText"> | null;
}): PageValidation {
  const normalizedRequested = canonicalAnalyzerUrl(scrape.requestedUrl);
  const normalizedFinal = canonicalAnalyzerUrl(scrape.finalUrl);
  const homepageUrl = homepageScrape?.finalUrl
    ? canonicalAnalyzerUrl(homepageScrape.finalUrl)
    : normalizedRequested
      ? rootUrl(normalizedRequested)
      : "";
  const duplicateByHash =
    requestedPageType !== "homepage" &&
    Boolean(homepageScrape?.hash) &&
    homepageScrape?.hash === scrape.hash;
  const duplicateByUrl =
    requestedPageType !== "homepage" &&
    Boolean(homepageUrl) &&
    (normalizedFinal === homepageUrl ||
      (isHomepageUrl(normalizedFinal) && !isHomepageUrl(normalizedRequested)));
  const duplicate = duplicateByHash || duplicateByUrl;
  const warnings: string[] = [];

  let detected: { type: DetectedPageType; confidence: number };

  if (isMissing(scrape)) {
    detected = { type: "missing", confidence: 0.98 };
  } else if (isBlocked(scrape)) {
    detected = { type: "blocked", confidence: 0.94 };
  } else if (duplicate) {
    detected = { type: "duplicate_homepage", confidence: duplicateByHash ? 0.98 : 0.9 };
  } else if (!scrape.ok) {
    detected = { type: "unknown", confidence: 0.24 };
  } else {
    detected = detectContentPageType(scrape);
  }

  const pageTypeVerified =
    scrape.ok &&
    !duplicate &&
    detected.type === requestedPageType &&
    detected.confidence >= 0.58;
  const status =
    detected.type === requestedPageType && pageTypeVerified
      ? "verified"
      : statusForDetectedType(detected.type) === "verified"
        ? "mismatch"
        : statusForDetectedType(detected.type);

  if (duplicate) {
    warnings.push(
      `${requestedPageType} page matched the homepage response, so page-specific extraction was skipped.`,
    );
  } else if (!pageTypeVerified && scrape.ok) {
    warnings.push(
      `Expected ${requestedPageType} page, detected ${detected.type} with ${detected.confidence} confidence.`,
    );
  }

  return {
    requested_url: scrape.requestedUrl,
    final_url: scrape.finalUrl,
    normalized_requested_url: normalizedRequested,
    normalized_final_url: normalizedFinal,
    requested_page_type: requestedPageType,
    detected_page_type: detected.type,
    page_type_confidence: detected.confidence,
    content_hash: scrape.hash,
    is_duplicate_of_homepage: duplicate,
    page_type_verified: pageTypeVerified,
    extraction_allowed: pageTypeVerified,
    status,
    warnings,
  };
}
