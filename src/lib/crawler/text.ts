import * as cheerio from "cheerio";

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
  "[hidden]",
  "[aria-hidden='true']",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  "[id*='consent']",
  "[class*='newsletter']",
  "[id*='newsletter']",
];

const meaningfulSelectors = [
  "title",
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "li",
  "button",
  "a",
  "th",
  "td",
  "[role='button']",
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
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isUsefulSegment(value: string) {
  if (value.length < 2) {
    return false;
  }

  if (/^(accept|reject|manage cookies|privacy policy|terms)$/i.test(value)) {
    return false;
  }

  return true;
}

export function extractMeaningfulText(html: string) {
  const $ = cheerio.load(html);

  $(noiseSelectors.join(",")).remove();

  const segments: string[] = [];
  const seen = new Set<string>();

  $(meaningfulSelectors.join(",")).each((_, element) => {
    const segment = normalizeSegment($(element).text());

    if (!isUsefulSegment(segment) || seen.has(segment)) {
      return;
    }

    seen.add(segment);
    segments.push(segment);
  });

  if (segments.length < 8) {
    const fallback = normalizeSegment($("body").text());

    if (fallback) {
      segments.push(fallback);
    }
  }

  return segments.join("\n").trim();
}
