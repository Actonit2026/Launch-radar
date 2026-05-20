import * as cheerio from "cheerio";

export type PageLink = {
  url: string;
  text: string;
};

const noiseSelectors = [
  "script",
  "style",
  "noscript",
  "svg",
  "canvas",
  "iframe",
  "nav",
  "footer",
  "form",
  "template",
  "[hidden]",
  "[aria-hidden='true']",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[role='dialog']",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  "[id*='consent']",
  "[class*='newsletter']",
  "[id*='newsletter']",
  "[class*='popup']",
  "[id*='popup']",
  "[class*='modal']",
  "[id*='modal']",
  "[class*='tracking']",
  "[id*='tracking']",
];

const meaningfulSelectors = [
  "title",
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "li",
  "summary",
  "details",
  "button",
  "a",
  "tr",
  "th",
  "td",
  "[role='button']",
  "[class*='faq']",
  "[id*='faq']",
  "[class*='hero']",
  "[id*='hero']",
  "[class*='pricing']",
  "[id*='pricing']",
  "[class*='price']",
  "[id*='price']",
  "[class*='plan']",
  "[id*='plan']",
  "[class*='feature']",
  "[id*='feature']",
  "[class*='changelog']",
  "[id*='changelog']",
  "[class*='release']",
  "[id*='release']",
  "[class*='announcement']",
  "[id*='announcement']",
  "[class*='cta']",
  "[id*='cta']",
];

function normalizeSegment(value: string) {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function segmentKey(value: string) {
  return normalizeSegment(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}$\u20AC\u00A3%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulSegment(value: string) {
  if (value.length < 2) {
    return false;
  }

  if (
    /^(accept|reject|allow all|manage cookies|cookie settings|privacy policy|terms|terms of service|all rights reserved)$/i.test(
      value,
    )
  ) {
    return false;
  }

  if (
    /^(facebook|twitter|x|linkedin|instagram|youtube|github|discord|slack)$/i.test(
      value,
    )
  ) {
    return false;
  }

  if (/^(privacy|legal|security|status|careers|jobs)$/i.test(value)) {
    return false;
  }

  if (/^\u00A9|\bcopyright\b|\ball rights reserved\b/i.test(value)) {
    return false;
  }

  return true;
}

function collectTextSegment(
  segments: string[],
  seen: Set<string>,
  value: string,
) {
  const segment = normalizeSegment(value);
  const key = segmentKey(segment);

  if (!key || !isUsefulSegment(segment) || seen.has(key)) {
    return;
  }

  seen.add(key);
  segments.push(segment);
}

function textWithSeparators(
  $: cheerio.CheerioAPI,
  element: Parameters<cheerio.CheerioAPI>[0],
) {
  const clone = $(element).clone();

  clone
    .find("br,p,h1,h2,h3,h4,li,button,a,summary,td,th")
    .after(" ");

  return clone.text();
}

export function extractMeaningfulText(html: string) {
  const $ = cheerio.load(html);

  $(noiseSelectors.join(",")).remove();

  const segments: string[] = [];
  const seen = new Set<string>();
  const title = extractPageTitle(html);
  const metaDescription = extractMetaDescription(html);

  collectTextSegment(segments, seen, title);
  collectTextSegment(segments, seen, metaDescription);

  $(meaningfulSelectors.join(",")).each((_, element) => {
    collectTextSegment(segments, seen, textWithSeparators($, element));
  });

  if (segments.length < 8) {
    $("main, article, section, body")
      .first()
      .text()
      .split(/[\n\r]+|(?<=[.!?])\s+(?=[A-Z0-9])/)
      .slice(0, 40)
      .forEach((segment) => collectTextSegment(segments, seen, segment));
  }

  return segments.join("\n").trim();
}

export function extractPageTitle(html: string) {
  const $ = cheerio.load(html);

  return $("title").first().text().replace(/\s+/g, " ").trim();
}

export function extractMetaDescription(html: string) {
  const $ = cheerio.load(html);

  return (
    $('meta[name="description"]').attr("content") ??
    $('meta[property="og:description"]').attr("content") ??
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractPageLinks(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const linksByUrl = new Map<string, PageLink>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();

    if (
      !href ||
      href.startsWith("#") ||
      /^(?:mailto|tel|javascript):/i.test(href)
    ) {
      return;
    }

    try {
      const url = new URL(href, baseUrl);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return;
      }

      url.hash = "";

      const normalizedUrl = url.toString();
      const text =
        segmentKey($(element).text()) ||
        segmentKey($(element).attr("aria-label") ?? "") ||
        segmentKey($(element).attr("title") ?? "");
      const existing = linksByUrl.get(normalizedUrl);

      if (!existing || (!existing.text && text)) {
        linksByUrl.set(normalizedUrl, {
          url: normalizedUrl,
          text,
        });
      }
    } catch {
      // Ignore malformed or unsupported links.
    }
  });

  return Array.from(linksByUrl.values()).slice(0, 200);
}
