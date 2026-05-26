import { createHash } from "node:crypto";
import { visibleMeaningfulText } from "@/lib/analyzer-v3/page/cleanDom";
import { extractAnalyzerMetadata } from "@/lib/analyzer-v3/page/extractMetadata";
import { validateAnalyzerUrl } from "@/lib/analyzer-v3/url/validateUrl";
import { resolveSafeIp } from "@/lib/analyzer-v3/url/resolveSafeIp";
import type { FetchPageResult } from "@/lib/analyzer-v3/types";

const fetchTimeoutMs = Number(process.env.ANALYZER_V3_FETCH_TIMEOUT_MS ?? 10000);

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function pageId(url: string) {
  return hash(url).slice(0, 12);
}

function failedPage(url: string, error: unknown, statusCode: number | null = null): FetchPageResult {
  const message = error instanceof Error ? error.message : String(error);
  const blocked = /blocked|forbidden|private|internal|robots|403/i.test(message) || statusCode === 401 || statusCode === 403;
  const timedOut = /timeout|abort/i.test(message);

  return {
    id: pageId(url),
    requested_url: url,
    final_url: url,
    status_code: statusCode,
    fetch_method: "failed",
    content_type: null,
    redirected: false,
    blocked,
    timed_out: timedOut,
    html: "",
    text: "",
    title: "",
    meta_description: "",
    html_hash: hash(""),
    text_hash: hash(""),
    dom_hash: hash(""),
    fetched_at: new Date().toISOString(),
    render_required: false,
    render_used: false,
    error: message,
    warnings: [message],
  };
}

function renderRequired(html: string, text: string) {
  return (
    text.length < 160 &&
    /\b(?:__NEXT_DATA__|id=["']root["']|id=["']__next["']|data-reactroot|enable javascript|javascript is required|vite|webpack)\b/i.test(
      html,
    )
  );
}

export function buildFixturePage({
  url,
  html,
  statusCode = 200,
  contentType = "text/html",
}: {
  url: string;
  html: string;
  statusCode?: number;
  contentType?: string;
}): FetchPageResult {
  const metadata = extractAnalyzerMetadata(html);
  const text = visibleMeaningfulText(html);

  return {
    id: pageId(url),
    requested_url: url,
    final_url: url,
    status_code: statusCode,
    fetch_method: "fixture",
    content_type: contentType,
    redirected: false,
    blocked: statusCode === 401 || statusCode === 403,
    timed_out: false,
    html,
    text,
    title: metadata.title,
    meta_description: metadata.meta_description,
    html_hash: hash(html),
    text_hash: hash(text),
    dom_hash: hash(text),
    fetched_at: new Date().toISOString(),
    render_required: renderRequired(html, text),
    render_used: false,
    warnings: [],
  };
}

export async function fetchPage(url: string): Promise<FetchPageResult> {
  const normalized = validateAnalyzerUrl(url);
  const safeUrl = normalized.canonical_url;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  try {
    await resolveSafeIp(new URL(safeUrl).hostname);

    const response = await fetch(safeUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "LaunchRadarBot/3.0 (+https://launchradar.app)",
      },
    });
    const finalUrl = validateAnalyzerUrl(response.url || safeUrl).canonical_url;
    const html = await response.text();
    const metadata = extractAnalyzerMetadata(html);
    const text = visibleMeaningfulText(html);
    const needsRender = renderRequired(html, text) || /enable javascript|checking your browser|captcha/i.test(html);

    return {
      id: pageId(safeUrl),
      requested_url: safeUrl,
      final_url: finalUrl,
      status_code: response.status,
      fetch_method: "fetch",
      content_type: response.headers.get("content-type"),
      redirected: finalUrl !== safeUrl,
      blocked: response.status === 401 || response.status === 403,
      timed_out: false,
      html,
      text,
      title: metadata.title,
      meta_description: metadata.meta_description,
      html_hash: hash(html),
      text_hash: hash(text),
      dom_hash: hash(text),
      fetched_at: new Date().toISOString(),
      render_required: needsRender,
      render_used: false,
      warnings: needsRender ? ["Static fetch found a JavaScript-heavy or blocked shell."] : [],
    };
  } catch (error) {
    return failedPage(safeUrl, error);
  } finally {
    clearTimeout(timeout);
  }
}
