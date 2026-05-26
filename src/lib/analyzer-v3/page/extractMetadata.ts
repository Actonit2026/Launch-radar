import * as cheerio from "cheerio";

function clean(value: string | undefined | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function extractAnalyzerMetadata(html: string) {
  const $ = cheerio.load(html || "<html><body></body></html>");

  return {
    title: clean($("title").first().text()),
    meta_description: clean(
      $('meta[name="description"]').attr("content") ??
        $('meta[property="og:description"]').attr("content"),
    ),
    h1: clean($("h1").first().text()) || null,
  };
}
