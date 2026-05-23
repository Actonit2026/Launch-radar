import * as cheerio from "cheerio";

type CheerioElement = Parameters<cheerio.CheerioAPI>[0] & {
  tagName?: string;
};

export type PageLink = {
  url: string;
  text: string;
};

export type PageBlockType =
  | "hero"
  | "pricing"
  | "features"
  | "cta"
  | "faq"
  | "comparison"
  | "changelog"
  | "footer"
  | "nav"
  | "auth"
  | "unknown";

export type PageBlock = {
  type: PageBlockType;
  heading: string | null;
  text: string;
  buttons: string[];
  links: PageLink[];
  confidence: number;
  index: number;
};

export type PageModel = {
  url: string;
  title: string;
  metaDescription: string;
  meta_description: string;
  ogTitle: string;
  og_title: string;
  ogDescription: string;
  og_description: string;
  h1: string | null;
  hero: PageBlock | null;
  heroBlocks: PageBlock[];
  hero_blocks: PageBlock[];
  pricingBlocks: PageBlock[];
  pricing_blocks: PageBlock[];
  featureBlocks: PageBlock[];
  feature_blocks: PageBlock[];
  ctaBlocks: PageBlock[];
  cta_blocks: PageBlock[];
  changelogBlocks: PageBlock[];
  changelog_blocks: PageBlock[];
  faqBlocks: PageBlock[];
  faq_blocks: PageBlock[];
  nav: PageBlock[];
  navBlocks: PageBlock[];
  nav_blocks: PageBlock[];
  footer: PageBlock[];
  footerBlocks: PageBlock[];
  footer_blocks: PageBlock[];
  authBlocks: PageBlock[];
  auth_blocks: PageBlock[];
  blocks: PageBlock[];
  visibleContent: string;
  visible_text: string;
  debug: {
    block_count: number;
    classification_counts: Record<PageBlockType, number>;
    ignored_block_types: PageBlockType[];
  };
};

const noiseSelectors = [
  "script",
  "style",
  "noscript",
  "svg",
  "canvas",
  "iframe",
  "template",
  "[hidden]",
  "[aria-hidden='true']",
  "[role='dialog']",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  "[id*='consent']",
  "[class*='newsletter']",
  "[id*='newsletter']",
  "[class*='tracking']",
  "[id*='tracking']",
];

const modelNoiseSelectors = [
  "script",
  "style",
  "noscript",
  "svg",
  "canvas",
  "iframe",
  "template",
  "[hidden]",
  "[aria-hidden='true']",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  "[id*='consent']",
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

function elementAttributes($: cheerio.CheerioAPI, element: CheerioElement) {
  const node = $(element);

  return [
    element.tagName,
    node.attr("id"),
    node.attr("class"),
    node.attr("role"),
    node.attr("aria-label"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function textSegmentsFromElement(
  $: cheerio.CheerioAPI,
  element: CheerioElement,
) {
  const clone = $(element).clone();

  clone
    .find("br,p,h1,h2,h3,h4,li,button,a,summary,td,th,label,span")
    .after("\n");

  return clone
    .text()
    .split(/\n+/)
    .map(normalizeSegment)
    .filter(isUsefulSegment);
}

function linksForElement(
  $: cheerio.CheerioAPI,
  element: CheerioElement,
  baseUrl: string,
) {
  const links: PageLink[] = [];
  const seen = new Set<string>();

  $(element)
    .find("a[href]")
    .each((_, link) => {
      const href = $(link).attr("href")?.trim();

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

        const text =
          normalizeSegment($(link).text()) ||
          normalizeSegment($(link).attr("aria-label") ?? "") ||
          normalizeSegment($(link).attr("title") ?? "");
        const key = `${url.toString()}:${segmentKey(text)}`;

        if (seen.has(key)) {
          return;
        }

        seen.add(key);
        links.push({ url: url.toString(), text });
      } catch {
        // Ignore malformed links in the page model.
      }
    });

  return links.slice(0, 20);
}

function buttonsForElement($: cheerio.CheerioAPI, element: CheerioElement) {
  return Array.from(
    new Set(
      $(element)
        .find("button,[role='button'],input[type='submit'],a")
        .map((_, button) =>
          normalizeSegment(
            $(button).text() ||
              $(button).attr("value") ||
              $(button).attr("aria-label") ||
              "",
          ),
        )
        .get()
        .filter((value) => value.length >= 2 && value.length <= 80),
    ),
  ).slice(0, 12);
}

function headingForElement($: cheerio.CheerioAPI, element: CheerioElement) {
  return (
    normalizeSegment($(element).find("h1,h2,h3").first().text()) ||
    normalizeSegment($(element).attr("aria-label") ?? "") ||
    null
  );
}

function hasPriceSignal(value: string) {
  return /[$\u20AC\u00A3]\s?\d|\d\s?[$\u20AC\u00A3]|\b(?:eur|usd|gbp)\b\s?\d|\d\s?\b(?:eur|usd|gbp)\b/i.test(
    value,
  );
}

function ogValue($: cheerio.CheerioAPI, property: string) {
  return (
    $(`meta[property='${property}']`).attr("content") ??
    $(`meta[name='${property}']`).attr("content") ??
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function classificationCounts(blocks: PageBlock[]) {
  const counts = {
    hero: 0,
    pricing: 0,
    features: 0,
    cta: 0,
    faq: 0,
    comparison: 0,
    changelog: 0,
    footer: 0,
    nav: 0,
    auth: 0,
    unknown: 0,
  } satisfies Record<PageBlockType, number>;

  blocks.forEach((block) => {
    counts[block.type] += 1;
  });

  return counts;
}

function classifyBlock({
  element,
  attrs,
  text,
  buttons,
  index,
}: {
  element: CheerioElement;
  attrs: string;
  text: string;
  buttons: string[];
  index: number;
}): { type: PageBlockType; confidence: number } {
  const signalText = `${attrs}\n${text}\n${buttons.join("\n")}`;
  const tag = element.tagName?.toLowerCase();
  const hasPricing =
    hasPriceSignal(signalText) ||
    /\b(?:pricing|price|prices|plan|plans|package|packages|tier|starter|plus|pro|premium|enterprise|upgrade|billing|subscription)\b/i.test(
      signalText,
    );
  const hasCta =
    /\b(?:start free|sign up|signup|get started|book demo|schedule demo|contact sales|try free|upgrade|download|join|get plus)\b/i.test(
      signalText,
    );

  if (tag === "nav" || /\bnav(?:igation)?\b|navbar|menu/.test(attrs)) {
    return { type: "nav", confidence: 0.92 };
  }

  if (tag === "footer" || /\bfooter|contentinfo\b/.test(attrs)) {
    return { type: "footer", confidence: 0.92 };
  }

  if (
    !hasPricing &&
    /\b(?:login|log in|sign in|password|account|dashboard)\b/i.test(signalText)
  ) {
    return { type: "auth", confidence: 0.82 };
  }

  if (hasPricing) {
    return { type: "pricing", confidence: 0.88 };
  }

  if (/\b(?:changelog|updates|release notes|release-notes|releases|shipped|fixed|improved|new in)\b/i.test(signalText)) {
    return { type: "changelog", confidence: 0.82 };
  }

  if (/\b(?:feature|features|integration|automation|workflow|dashboard|analytics|templates|alerts|personalization|voice|proposal|generation|matching)\b/i.test(signalText)) {
    return { type: "features", confidence: 0.74 };
  }

  if (/\b(?:faq|frequently asked)\b/i.test(signalText)) {
    return { type: "faq", confidence: 0.7 };
  }

  if (/\b(?:compare|versus|alternative)\b/i.test(signalText)) {
    return { type: "comparison", confidence: 0.66 };
  }

  if (hasCta) {
    return { type: "cta", confidence: 0.68 };
  }

  if (tag === "header" || /\bhero|masthead\b/.test(attrs) || index <= 1) {
    return { type: "hero", confidence: 0.72 };
  }

  return { type: "unknown", confidence: 0.45 };
}

function shouldKeepBlock(block: PageBlock) {
  if (!block.text && !block.heading && !block.buttons.length) {
    return false;
  }

  if (block.text.length < 4 && !block.buttons.length) {
    return false;
  }

  return true;
}

export function buildPageModel(html: string, baseUrl: string): PageModel {
  const $ = cheerio.load(html);

  $(modelNoiseSelectors.join(",")).remove();

  const title = extractPageTitle(html);
  const metaDescription = extractMetaDescription(html);
  const ogTitle = ogValue($, "og:title");
  const ogDescription = ogValue($, "og:description");
  const h1 = normalizeSegment($("h1").first().text()) || null;
  const rawElements = $("nav,footer,header,main > section,main > article,main > div,section,article,form,dialog,[role='dialog'],[class*='modal'],[id*='modal'],[class*='pricing'],[id*='pricing'],[class*='price'],[id*='price'],[class*='plan'],[id*='plan'],[class*='feature'],[id*='feature'],[class*='hero'],[id*='hero'],[class*='cta'],[id*='cta'],[class*='changelog'],[id*='changelog'],table")
    .toArray()
    .slice(0, 120);
  const bodyFallback =
    rawElements.length > 0 ? rawElements : $("main,body").toArray().slice(0, 1);
  const seen = new Set<string>();
  const blocks: PageBlock[] = [];

  bodyFallback.forEach((element, rawIndex) => {
    const segments = textSegmentsFromElement($, element);
    const text = segments.join("\n");
    const heading = headingForElement($, element);
    const buttons = buttonsForElement($, element);
    const attrs = elementAttributes($, element);
    const key = segmentKey(`${heading ?? ""}\n${text}\n${buttons.join("\n")}`);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);

    const classification = classifyBlock({
      element,
      attrs,
      text,
      buttons,
      index: rawIndex,
    });
    const block: PageBlock = {
      type: classification.type,
      heading,
      text,
      buttons,
      links: linksForElement($, element, baseUrl),
      confidence: classification.confidence,
      index: blocks.length,
    };

    if (shouldKeepBlock(block)) {
      blocks.push(block);
    }
  });

  const visibleBlocks = blocks.filter(
    (block) => !["nav", "footer", "auth"].includes(block.type),
  );
  const heroBlocks = visibleBlocks.filter((block) => block.type === "hero");
  const pricingBlocks = visibleBlocks.filter((block) => block.type === "pricing");
  const featureBlocks = visibleBlocks.filter((block) => block.type === "features");
  const ctaBlocks = visibleBlocks.filter((block) => block.type === "cta");
  const changelogBlocks = visibleBlocks.filter(
    (block) => block.type === "changelog",
  );
  const faqBlocks = visibleBlocks.filter((block) => block.type === "faq");
  const navBlocks = blocks.filter((block) => block.type === "nav");
  const footerBlocks = blocks.filter((block) => block.type === "footer");
  const authBlocks = blocks.filter((block) => block.type === "auth");
  const hero =
    heroBlocks[0] ??
    visibleBlocks.find((block) => block.heading || block.text) ??
    null;
  const visibleContent = visibleBlocks
    .flatMap((block) => [
      block.heading ?? "",
      block.text,
      ...block.buttons,
      ...block.links.map((link) => link.text),
    ])
    .filter(Boolean)
    .join("\n");

  return {
    url: baseUrl,
    title,
    metaDescription,
    meta_description: metaDescription,
    ogTitle,
    og_title: ogTitle,
    ogDescription,
    og_description: ogDescription,
    h1,
    hero,
    heroBlocks,
    hero_blocks: heroBlocks,
    pricingBlocks,
    pricing_blocks: pricingBlocks,
    featureBlocks,
    feature_blocks: featureBlocks,
    ctaBlocks,
    cta_blocks: ctaBlocks,
    changelogBlocks,
    changelog_blocks: changelogBlocks,
    faqBlocks,
    faq_blocks: faqBlocks,
    nav: navBlocks,
    navBlocks,
    nav_blocks: navBlocks,
    footer: footerBlocks,
    footerBlocks,
    footer_blocks: footerBlocks,
    authBlocks,
    auth_blocks: authBlocks,
    blocks,
    visibleContent,
    visible_text: visibleContent,
    debug: {
      block_count: blocks.length,
      classification_counts: classificationCounts(blocks),
      ignored_block_types: ["nav", "footer", "auth"],
    },
  };
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
