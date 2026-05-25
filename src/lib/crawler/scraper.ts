import { createHash } from "node:crypto";
import { getChromiumLaunchOptions } from "@/lib/crawler/browser";
import { crawlerUserAgent, isAllowedByRobots } from "@/lib/crawler/robots";
import {
  extractMeaningfulText,
  extractMetaDescription,
  extractPageLinks,
  extractPageTitle,
  buildPageModel,
  type PageModel,
  type PageLink,
} from "@/lib/crawler/text";

export type ScrapedPage = {
  requestedUrl: string;
  finalUrl: string;
  redirected?: boolean;
  title: string;
  metaDescription: string;
  status: number | null;
  fetchStatus?: "success" | "failed";
  ok: boolean;
  rawText: string;
  hash: string;
  links: PageLink[];
  pageModel?: PageModel;
  rendering?: "static" | "browser";
  javascriptHeavy?: boolean;
  warnings?: string[];
  error?: string;
  errorType?:
    | "not_found"
    | "blocked"
    | "timeout"
    | "dns_error"
    | "ssl_error"
    | "server_error"
    | "network_error"
    | "empty_content"
    | "javascript_heavy"
    | "unknown_error";
};

const blockedResourceTypes = new Set(["font", "image", "media"]);
const configuredFetchTimeoutMs = Number(process.env.LAUNCHRADAR_FETCH_TIMEOUT_MS);
const fetchTimeoutMs =
  Number.isFinite(configuredFetchTimeoutMs) && configuredFetchTimeoutMs > 0
    ? configuredFetchTimeoutMs
    : 6500;
const staticMeaningfulTextThreshold = 140;
const domainDelayMs = 500;
const lastFetchByDomain = new Map<string, number>();

export function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function errorTypeFor(error: unknown, status?: number | null): NonNullable<ScrapedPage["errorType"]> {
  const message = error instanceof Error ? error.message : String(error);

  if (status === 404 || status === 410) return "not_found";
  if (status === 401 || status === 403) return "blocked";
  if (status && status >= 500) return "server_error";
  if (/robots|forbidden|blocked|403/i.test(message)) return "blocked";
  if (/abort|timeout/i.test(message)) return "timeout";
  if (/ENOTFOUND|dns|getaddrinfo|not found/i.test(message)) return "dns_error";
  if (/certificate|ssl|tls/i.test(message)) return "ssl_error";
  if (/fetch failed|network|ECONN|EAI_AGAIN/i.test(message)) return "network_error";

  return "unknown_error";
}

function failedScrape(url: string, error: unknown, status: number | null = null): ScrapedPage {
  return {
    requestedUrl: url,
    finalUrl: url,
    redirected: false,
    title: "",
    metaDescription: "",
    status,
    fetchStatus: "failed",
    ok: false,
    rawText: "",
    hash: hashText(""),
    links: [],
    rendering: "static",
    error: error instanceof Error ? error.message : "Unknown scrape error.",
    errorType: errorTypeFor(error, status),
  };
}

function attachFetchMetadata(
  pageModel: PageModel,
  {
    finalUrl,
    status,
    fetchStatus,
    redirected,
  }: {
    finalUrl: string;
    status: number | null;
    fetchStatus: "success" | "failed";
    redirected: boolean;
  },
) {
  return {
    ...pageModel,
    fetch_status: fetchStatus,
    http_status: status,
    final_url: finalUrl,
    redirected,
  };
}

function userFriendlyBlockedMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/robots\.txt/i.test(message)) {
    return "This page disallows automated public analysis via robots.txt.";
  }

  if (/abort|timeout/i.test(message)) {
    return "This page could not be analyzed before the crawler timeout.";
  }

  if (/fetch failed|network|certificate|ECONN|ENOTFOUND/i.test(message)) {
    return "This page could not be analyzed. The site may block automated public fetches.";
  }

  return message || "This page could not be analyzed.";
}

function appearsJavaScriptHeavy(html: string, rawText: string) {
  const scriptCount = (html.match(/<script\b/gi) ?? []).length;
  const appShellSignals =
    /\b(?:__NEXT_DATA__|id=["']root["']|id=["']__next["']|data-reactroot|vite|webpack|app-root|ng-version)\b/i.test(
      html,
    );
  const hasLargeScriptPayload = scriptCount >= 5 || html.length > 80_000;

  return rawText.trim().length < staticMeaningfulTextThreshold &&
    (appShellSignals || hasLargeScriptPayload);
}

function javascriptHeavyWarning() {
  return "This site appears JavaScript-heavy. Static analysis was limited.";
}

function browserFallbackEnabled() {
  if (process.env.LAUNCHRADAR_BROWSER_FALLBACK === "1") {
    return true;
  }

  return (
    process.env.NODE_ENV !== "production" &&
    process.env.LAUNCHRADAR_BROWSER_FALLBACK !== "0"
  );
}

function domainFor(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
}

async function waitForDomainSlot(url: string) {
  const domain = domainFor(url);
  const lastFetch = lastFetchByDomain.get(domain) ?? 0;
  const waitMs = Math.max(0, domainDelayMs - (Date.now() - lastFetch));

  if (waitMs) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  lastFetchByDomain.set(domain, Date.now());
}

async function scrapePageWithFetch(url: string): Promise<ScrapedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  try {
    await waitForDomainSlot(url);

    if (!(await isAllowedByRobots(url))) {
      return {
        ...failedScrape(
          url,
          new Error("This page disallows automated public analysis via robots.txt."),
          403,
        ),
      };
    }

    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": crawlerUserAgent(),
      },
    });
    const html = await response.text();
    const finalUrl = response.url || url;
    const rawText = extractMeaningfulText(html);
    const status = response.status;
    const fetchStatus = response.ok ? "success" : "failed";
    const pageModel = attachFetchMetadata(buildPageModel(html, finalUrl), {
      finalUrl,
      status,
      fetchStatus,
      redirected: finalUrl !== url,
    });
    const javascriptHeavy = appearsJavaScriptHeavy(html, rawText);
    const warnings = javascriptHeavy ? [javascriptHeavyWarning()] : [];

    return {
      requestedUrl: url,
      finalUrl,
      redirected: finalUrl !== url,
      title: extractPageTitle(html),
      metaDescription: extractMetaDescription(html),
      status,
      fetchStatus,
      ok: response.ok && rawText.length > 0 && !javascriptHeavy,
      rawText,
      hash: hashText(rawText),
      links: extractPageLinks(html, finalUrl),
      pageModel,
      rendering: "static",
      javascriptHeavy,
      warnings,
      ...(rawText
        ? {}
        : {
            error: javascriptHeavy
              ? javascriptHeavyWarning()
              : "No meaningful text extracted.",
            errorType: javascriptHeavy ? "javascript_heavy" : "empty_content",
          }),
      ...(!response.ok ? { errorType: errorTypeFor(`HTTP ${status}`, status) } : {}),
    };
  } catch (error) {
    return failedScrape(url, new Error(userFriendlyBlockedMessage(error)));
  } finally {
    clearTimeout(timeout);
  }
}

async function scrapePagesWithBrowser(urls: string[]): Promise<ScrapedPage[]> {
  if (!urls.length) {
    return [];
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch(getChromiumLaunchOptions());
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: crawlerUserAgent(),
    viewport: {
      width: 1365,
      height: 900,
    },
  });

  await context.route("**/*", async (route) => {
    if (blockedResourceTypes.has(route.request().resourceType())) {
      await route.abort();
      return;
    }

    await route.continue();
  });

  const results: ScrapedPage[] = [];

  try {
    for (const url of urls) {
      const page = await context.newPage();

      try {
        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        await page
          .waitForLoadState("networkidle", {
            timeout: 5000,
          })
          .catch(() => undefined);

        const html = await page.content();
        const finalUrl = page.url();
        const rawText = extractMeaningfulText(html);
        const status = response?.status() ?? null;
        const fetchStatus = status === null || status < 400 ? "success" : "failed";
        const pageModel = attachFetchMetadata(buildPageModel(html, finalUrl), {
          finalUrl,
          status,
          fetchStatus,
          redirected: finalUrl !== url,
        });

        results.push({
          requestedUrl: url,
          finalUrl,
          redirected: finalUrl !== url,
          title: await page.title(),
          metaDescription: extractMetaDescription(html),
          status,
          fetchStatus,
          ok: (status === null || status < 400) && rawText.length > 0,
          rawText,
          hash: hashText(rawText),
          links: extractPageLinks(html, finalUrl),
          pageModel,
          rendering: "browser",
          ...((status !== null && status >= 400)
            ? { errorType: errorTypeFor(`HTTP ${status}`, status) }
            : {}),
        });
      } catch (error) {
        results.push(failedScrape(url, new Error(userFriendlyBlockedMessage(error))));
      } finally {
        await page.close().catch(() => undefined);
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

export async function scrapePages(urls: string[]): Promise<ScrapedPage[]> {
  if (!urls.length) {
    return [];
  }

  const fetchResults = await Promise.all(urls.map(scrapePageWithFetch));
  const urlsNeedingBrowser = fetchResults
    .filter((result) => !result.ok)
    .map((result) => result.requestedUrl);

  if (!urlsNeedingBrowser.length || !browserFallbackEnabled()) {
    return fetchResults;
  }

  try {
    const browserResults = await scrapePagesWithBrowser(urlsNeedingBrowser);
    const browserByUrl = new Map(
      browserResults.map((result) => [result.requestedUrl, result]),
    );

    return fetchResults.map((result) => {
      const browserResult = browserByUrl.get(result.requestedUrl);

      return browserResult?.ok ? browserResult : result;
    });
  } catch (error) {
    const message = userFriendlyBlockedMessage(error);

    return fetchResults.map((result) =>
      urlsNeedingBrowser.includes(result.requestedUrl)
        ? {
            ...result,
            error: result.error ?? message,
          }
        : result,
    );
  }
}
