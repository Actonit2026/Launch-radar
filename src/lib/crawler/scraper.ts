import { createHash } from "node:crypto";
import { getChromiumLaunchOptions } from "@/lib/crawler/browser";
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
  title: string;
  metaDescription: string;
  status: number | null;
  ok: boolean;
  rawText: string;
  hash: string;
  links: PageLink[];
  pageModel?: PageModel;
  error?: string;
};

const blockedResourceTypes = new Set(["font", "image", "media"]);
const fetchTimeoutMs = 20000;

export function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function failedScrape(url: string, error: unknown): ScrapedPage {
  return {
    requestedUrl: url,
    finalUrl: url,
    title: "",
    metaDescription: "",
    status: null,
    ok: false,
    rawText: "",
    hash: hashText(""),
    links: [],
    error: error instanceof Error ? error.message : "Unknown scrape error.",
  };
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

async function scrapePageWithFetch(url: string): Promise<ScrapedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "Mozilla/5.0 (compatible; LaunchRadar/0.1; +https://launchradar.local)",
      },
    });
    const html = await response.text();
    const finalUrl = response.url || url;
    const rawText = extractMeaningfulText(html);
    const pageModel = buildPageModel(html, finalUrl);
    const status = response.status;

    return {
      requestedUrl: url,
      finalUrl,
      title: extractPageTitle(html),
      metaDescription: extractMetaDescription(html),
      status,
      ok: response.ok && rawText.length > 0,
      rawText,
      hash: hashText(rawText),
      links: extractPageLinks(html, finalUrl),
      pageModel,
      ...(rawText ? {} : { error: "No meaningful text extracted." }),
    };
  } catch (error) {
    return failedScrape(url, error);
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
    userAgent:
      "Mozilla/5.0 (compatible; LaunchRadar/0.1; +https://launchradar.local)",
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
        const pageModel = buildPageModel(html, finalUrl);
        const status = response?.status() ?? null;

        results.push({
          requestedUrl: url,
          finalUrl,
          title: await page.title(),
          metaDescription: extractMetaDescription(html),
          status,
          ok: (status === null || status < 400) && rawText.length > 0,
          rawText,
          hash: hashText(rawText),
          links: extractPageLinks(html, finalUrl),
          pageModel,
        });
      } catch (error) {
        results.push(failedScrape(url, error));
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
    const message =
      error instanceof Error ? error.message : "Browser fallback failed.";

    return fetchResults.map((result) =>
      urlsNeedingBrowser.includes(result.requestedUrl)
        ? {
            ...result,
            error: `${result.error ?? "Fetch scrape failed."} Browser fallback failed: ${message}`,
          }
        : result,
    );
  }
}
