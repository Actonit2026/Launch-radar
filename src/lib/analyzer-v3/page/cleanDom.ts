import * as cheerio from "cheerio";

const removeSelectors = [
  "script",
  "style",
  "noscript",
  "canvas",
  "iframe",
  "template",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  "[id*='consent']",
  "[class*='tracking']",
  "[id*='tracking']",
];

const downrankSelectors = [
  "nav",
  "footer",
  "[role='navigation']",
  "[role='contentinfo']",
  "[class*='nav']",
  "[class*='footer']",
  "[id*='nav']",
  "[id*='footer']",
];

function markVisibility($: cheerio.CheerioAPI) {
  $("[hidden], [style*='display: none'], [style*='visibility: hidden']").attr(
    "data-lr-visibility",
    "hidden_but_in_dom",
  );
  $("[aria-hidden='true']").attr("data-lr-visibility", "aria_hidden");
  $("dialog,[role='dialog'],[class*='modal'],[id*='modal']").attr(
    "data-lr-visibility",
    "modal",
  );
  $("[aria-expanded='false'],details:not([open])").attr(
    "data-lr-visibility",
    "collapsed",
  );
}

export function loadCleanDom(html: string) {
  const $ = cheerio.load(html || "<html><body></body></html>");

  $(removeSelectors.join(",")).remove();
  $(downrankSelectors.join(",")).attr("data-lr-downrank", "true");
  markVisibility($);

  return $;
}

export function visibleMeaningfulText(html: string) {
  const $ = loadCleanDom(html);
  const segments: string[] = [];
  const seen = new Set<string>();

  $("title,h1,h2,h3,h4,p,li,summary,button,a,th,td,label").each((_, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    const key = text.toLowerCase();

    if (!text || text.length < 2 || seen.has(key)) {
      return;
    }

    if (/^(privacy|terms|legal|login|log in|sign in|copyright)$/i.test(text)) {
      return;
    }

    seen.add(key);
    segments.push(text);
  });

  return segments.join("\n").trim();
}
