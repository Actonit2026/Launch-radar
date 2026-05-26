import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { loadCleanDom } from "@/lib/analyzer-v3/page/cleanDom";
import { classifyBlockRole } from "@/lib/analyzer-v3/blocks/classifyBlockRole";
import type {
  AnalyzerV3PageType,
  BlockVisibility,
  EvidenceBlock,
  FetchPageResult,
} from "@/lib/analyzer-v3/types";

type CheerioElement = Parameters<cheerio.CheerioAPI>[0] & {
  tagName?: string;
};

const blockSelector = [
  "nav",
  "header",
  "main",
  "footer",
  "section",
  "article",
  "aside",
  "form",
  "dialog",
  "table",
  "ul",
  "ol",
  "[role='dialog']",
  "[role='table']",
  "[class*='hero']",
  "[id*='hero']",
  "[class*='pricing']",
  "[id*='pricing']",
  "[class*='price']",
  "[id*='price']",
  "[class*='plan']",
  "[id*='plan']",
  "[class*='tier']",
  "[id*='tier']",
  "[class*='feature']",
  "[id*='feature']",
  "[class*='card']",
  "[class*='grid']",
  "[class*='changelog']",
  "[id*='changelog']",
  "[class*='release']",
  "[id*='release']",
  "[class*='update']",
  "[id*='update']",
  "[class*='modal']",
  "[id*='modal']",
].join(",");

function normalizeText(value: string) {
  return value
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedKey(value: string) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9$\u20ac\u00a3]+/g, " ");
}

function hashId(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function attrList(value?: string) {
  return (value ?? "").split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function domPath($: cheerio.CheerioAPI, element: CheerioElement) {
  const parts: string[] = [];
  let current = element;

  while (current && current.tagName && parts.length < 6) {
    const node = $(current);
    const id = node.attr("id");
    const classes = attrList(node.attr("class")).slice(0, 2).join(".");
    const siblingIndex = node.index() + 1;

    parts.unshift(
      `${current.tagName.toLowerCase()}${id ? `#${id}` : ""}${classes ? `.${classes}` : ""}:nth(${siblingIndex})`,
    );
    current = node.parent().get(0) as CheerioElement;
  }

  return parts.join(" > ");
}

function elementText($: cheerio.CheerioAPI, element: CheerioElement) {
  const clone = $(element).clone();

  clone.find("br,p,h1,h2,h3,h4,li,button,a,summary,td,th,label,span").after("\n");

  return clone
    .text()
    .split(/\n+/)
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");
}

function headingChain($: cheerio.CheerioAPI, element: CheerioElement) {
  const headings: string[] = [];
  const local = normalizeText($(element).find("h1,h2,h3,h4").first().text());

  if (local) {
    headings.push(local);
  }

  $(element)
    .parents("section,article,main")
    .each((_, parent) => {
      const heading = normalizeText($(parent).children("h1,h2,h3,h4").first().text());

      if (heading) {
        headings.unshift(heading);
      }
    });

  return Array.from(new Set(headings)).slice(-4);
}

function links($: cheerio.CheerioAPI, element: CheerioElement, baseUrl: string) {
  return $(element)
    .find("a[href]")
    .map((_, link) => {
      const href = $(link).attr("href");

      if (!href || /^(?:#|mailto:|tel:|javascript:)/i.test(href)) {
        return null;
      }

      try {
        const url = new URL(href, baseUrl);

        url.hash = "";
        return {
          url: url.toString(),
          text: normalizeText($(link).text() || $(link).attr("aria-label") || ""),
        };
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean)
    .slice(0, 20) as Array<{ url: string; text: string }>;
}

function buttons($: cheerio.CheerioAPI, element: CheerioElement) {
  return Array.from(
    new Set(
      $(element)
        .find("button,[role='button'],input[type='submit'],a")
        .map((_, button) =>
          normalizeText(
            $(button).text() ||
              $(button).attr("value") ||
              $(button).attr("aria-label") ||
              "",
          ),
        )
        .get()
        .filter((value) => value.length >= 2 && value.length <= 80),
    ),
  ).slice(0, 16);
}

function visibility($: cheerio.CheerioAPI, element: CheerioElement): BlockVisibility {
  return ($(element).attr("data-lr-visibility") as BlockVisibility | undefined) ?? "visible";
}

function tableShape($: cheerio.CheerioAPI, element: CheerioElement) {
  const rows = $(element).is("table,[role='table']")
    ? $(element).find("tr,[role='row']").length
    : $(element).find("table tr,[role='table'] [role='row']").length;
  const columns = $(element).is("table,[role='table']")
    ? $(element).find("tr,[role='row']").first().find("th,td,[role='cell'],[role='columnheader']").length
    : 0;

  return rows >= 1 ? { rows, columns } : null;
}

function listShape($: cheerio.CheerioAPI, element: CheerioElement) {
  const items = $(element).is("ul,ol") ? $(element).children("li").length : $(element).find("ul,ol").first().children("li").length;

  return items >= 1 ? { items } : null;
}

function nearbyPrices(text: string) {
  return Array.from(
    text.matchAll(/(?:[$\u20ac\u00a3]\s?\d[\d,.]*|\d[\d,.]*\s?[$\u20ac\u00a3]|\b(?:usd|eur|gbp)\s?\d[\d,.]*|\d[\d,.]*\s?(?:usd|eur|gbp)\b)/gi),
  )
    .map((match) => match[0])
    .slice(0, 12);
}

function nearbyPlanWords(text: string) {
  return Array.from(
    text.matchAll(/\b(?:free|starter|basic|plus|pro|premium|team|business|growth|scale|enterprise|custom|plan|tier|package)\b/gi),
  )
    .map((match) => match[0])
    .slice(0, 12);
}

function nearbyNegativeWords(text: string) {
  return Array.from(
    text.matchAll(/\b(?:example|sample|proposal|testimonial|case study|customer story|job|budget|upwork|freelancer|article|quote|project)\b/gi),
  )
    .map((match) => match[0])
    .slice(0, 12);
}

export function segmentDom({
  page,
  pageType,
}: {
  page: FetchPageResult;
  pageType: AnalyzerV3PageType;
}) {
  const $ = loadCleanDom(page.html);
  const candidates = $(blockSelector).toArray() as CheerioElement[];
  const fallback = candidates.length ? candidates : ($("body").toArray() as CheerioElement[]);
  const seen = new Set<string>();
  const blocks: EvidenceBlock[] = [];

  fallback.slice(0, 160).forEach((element, rawIndex) => {
    const node = $(element);
    const tagName = element.tagName?.toLowerCase() ?? "unknown";
    const text = elementText($, element);
    const localHeading = normalizeText(node.find("h1,h2,h3,h4").first().text()) || null;
    const ariaLabel = node.attr("aria-label") ?? null;
    const key = normalizedKey(`${tagName}\n${localHeading ?? ""}\n${text}`);

    if (!key || key.length < 4 || seen.has(key)) {
      return;
    }

    seen.add(key);

    const cssClasses = attrList(node.attr("class"));
    const idAttribute = node.attr("id") ?? null;
    const roleAttribute = node.attr("role") ?? null;
    const attrText = [tagName, idAttribute, cssClasses.join(" "), ariaLabel, roleAttribute].filter(Boolean).join(" ");
    const blockLinks = links($, element, page.final_url);
    const blockButtons = buttons($, element);
    const table = tableShape($, element);
    const list = listShape($, element);
    const classification = classifyBlockRole({
      text,
      tagName,
      attrText,
      pageType,
      positionIndex: blocks.length,
      tableRows: table?.rows ?? 0,
      tableColumns: table?.columns ?? 0,
    });
    const chain = headingChain($, element);

    blocks.push({
      id: `${page.id}:${hashId(`${rawIndex}:${key}`)}`,
      page_id: page.id,
      url: page.requested_url,
      final_url: page.final_url,
      page_type: pageType,
      tag_name: tagName,
      dom_path: domPath($, element),
      css_classes: cssClasses,
      id_attribute: idAttribute,
      aria_label: ariaLabel,
      role_attribute: roleAttribute,
      visibility: visibility($, element),
      text,
      normalized_text: normalizedKey(text),
      heading_chain: chain,
      local_heading: localHeading,
      parent_heading: chain[chain.length - 2] ?? null,
      sibling_group_id: node.parent().attr("class") ?? node.parent().prop("tagName") ?? null,
      sibling_index: node.index(),
      child_count: node.children().length,
      link_count: blockLinks.length,
      button_texts: blockButtons,
      nearby_links: blockLinks,
      nearby_prices: nearbyPrices(text),
      nearby_plan_words: nearbyPlanWords(text),
      nearby_negative_words: nearbyNegativeWords(text),
      table_shape: table,
      list_shape: list,
      position_index: blocks.length,
      viewport_order_estimate: blocks.length,
      role: classification.role,
      role_confidence: classification.confidence,
      positive_signals: classification.positiveSignals,
      negative_signals: classification.negativeSignals,
      evidence_score: Number(
        Math.min(1, classification.confidence + blockButtons.length * 0.02 + blockLinks.length * 0.01).toFixed(2),
      ),
    });
  });

  return blocks;
}
