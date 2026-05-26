import { buildFixturePage } from "@/lib/analyzer-v3/fetch/fetchPage";
import type { FetchPageResult } from "@/lib/analyzer-v3/types";

export function analyzerV3RenderEnabled() {
  return process.env.ANALYZER_V3_RENDER_ENABLED === "true";
}

export async function renderPage(url: string): Promise<FetchPageResult> {
  if (!analyzerV3RenderEnabled()) {
    return {
      ...buildFixturePage({ url, html: "", statusCode: 0 }),
      fetch_method: "failed",
      error: "Browser rendering disabled.",
      render_required: true,
      render_used: false,
      warnings: ["Browser rendering disabled."],
    };
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      userAgent: "LaunchRadarBot/3.0 (+https://launchradar.app)",
      viewport: { width: 1365, height: 900 },
    });
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);

    const html = await page.content();
    return {
      ...buildFixturePage({
        url: page.url(),
        html,
        statusCode: response?.status() ?? 200,
      }),
      requested_url: url,
      final_url: page.url(),
      fetch_method: "render",
      redirected: page.url() !== url,
      render_required: true,
      render_used: true,
    };
  } finally {
    await browser.close();
  }
}
