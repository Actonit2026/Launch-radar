import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { getChromiumLaunchOptions } from "@/lib/crawler/browser";
import { extractMeaningfulText } from "@/lib/crawler/text";

export type ScrapedPage = {
  requestedUrl: string;
  finalUrl: string;
  title: string;
  status: number | null;
  ok: boolean;
  rawText: string;
  hash: string;
  error?: string;
};

const blockedResourceTypes = new Set(["font", "image", "media"]);

export function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function failedScrape(url: string, error: unknown): ScrapedPage {
  return {
    requestedUrl: url,
    finalUrl: url,
    title: "",
    status: null,
    ok: false,
    rawText: "",
    hash: hashText(""),
    error: error instanceof Error ? error.message : "Unknown scrape error.",
  };
}

export async function scrapePages(urls: string[]): Promise<ScrapedPage[]> {
  if (!urls.length) {
    return [];
  }

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
        const rawText = extractMeaningfulText(html);
        const status = response?.status() ?? null;

        results.push({
          requestedUrl: url,
          finalUrl: page.url(),
          title: await page.title(),
          status,
          ok: (status === null || status < 400) && rawText.length > 0,
          rawText,
          hash: hashText(rawText),
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
