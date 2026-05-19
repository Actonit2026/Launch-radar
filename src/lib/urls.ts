import type { Database, PageType } from "@/lib/database.types";

const defaultPages: Array<{ pageType: PageType; path: string }> = [
  { pageType: "homepage", path: "/" },
  { pageType: "pricing", path: "/pricing" },
  { pageType: "features", path: "/features" },
  { pageType: "changelog", path: "/changelog" },
];

export function normalizeBaseUrl(input: string) {
  const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(candidate);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported URL protocol.");
  }

  return url.origin.replace(/\/$/, "");
}

export function createDefaultMonitoredPages(
  competitorId: string,
  baseUrl: string,
): Array<Database["public"]["Tables"]["monitored_pages"]["Insert"]> {
  return defaultPages.map(({ pageType, path }) => ({
    competitor_id: competitorId,
    page_type: pageType,
    url: new URL(path, baseUrl).toString().replace(/\/$/, path === "/" ? "/" : ""),
  }));
}
