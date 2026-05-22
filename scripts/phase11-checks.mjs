import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const outDir = await mkdtemp(path.join(tmpdir(), "launchradar-phase11-"));

delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_SUMMARY_MODEL;
process.env.LAUNCHRADAR_BROWSER_FALLBACK = "0";

const sourceFiles = [
  "src/lib/database.types.ts",
  "src/lib/urls.ts",
  "src/lib/crawler/text.ts",
  "src/lib/crawler/robots.ts",
  "src/lib/crawler/browser.ts",
  "src/lib/crawler/scraper.ts",
  "src/lib/change-detection.ts",
  "src/lib/crawler/discovery.ts",
  "src/lib/intelligence/types.ts",
  "src/lib/intelligence/text.ts",
  "src/lib/intelligence/pricing.ts",
  "src/lib/intelligence/positioning.ts",
  "src/lib/intelligence/ctas.ts",
  "src/lib/intelligence/features.ts",
  "src/lib/intelligence/changelog.ts",
  "src/lib/intelligence/analyze.ts",
  "src/lib/ai/config.ts",
  "src/lib/ai/intelligence-summary.ts",
].map((file) => path.join(rootDir, file));

const compilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  rootDir,
  outDir,
  esModuleInterop: true,
  skipLibCheck: true,
  strict: true,
  noEmitOnError: true,
  baseUrl: rootDir,
  paths: {
    "@/*": ["src/*"],
  },
};

function compileSources() {
  const program = ts.createProgram(sourceFiles, compilerOptions);
  const emit = program.emit();
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emit.diagnostics);

  if (diagnostics.length) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => rootDir,
      getNewLine: () => "\n",
    });
    throw new Error(formatted);
  }
}

function installAliasResolver() {
  const Module = require("node:module");
  const originalResolve = Module._resolveFilename;
  const rootModule = new Module(path.join(rootDir, "package.json"));
  rootModule.filename = path.join(rootDir, "package.json");
  rootModule.paths = Module._nodeModulePaths(rootDir);

  Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      const mapped = path.join(outDir, "src", `${request.slice(2)}.js`);
      return originalResolve.call(this, mapped, parent, isMain, options);
    }

    if (
      !request.startsWith(".") &&
      !path.isAbsolute(request) &&
      !Module.builtinModules.includes(request) &&
      !request.startsWith("node:")
    ) {
      try {
        return originalResolve.call(this, request, parent, isMain, options);
      } catch (error) {
        if (error?.code !== "MODULE_NOT_FOUND") {
          throw error;
        }

        return originalResolve.call(this, request, rootModule, isMain, options);
      }
    }

    return originalResolve.call(this, request, parent, isMain, options);
  };

  return () => {
    Module._resolveFilename = originalResolve;
  };
}

function html({ title, body, links = "" }) {
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${title} public page"></head><body><main>${links}${body}</main></body></html>`;
}

function response(res, status, contentType, body) {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

async function withFixtureSite(callback) {
  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", "http://fixture.local");

    switch (requestUrl.pathname) {
      case "/":
        response(
          res,
          200,
          "text/html",
          html({
            title: "FixtureCo homepage",
            links: [
              '<a href="/packages">Packages</a>',
              '<a href="/features">Features</a>',
              '<a href="/release-notes">Release notes</a>',
              '<a href="/blog">Blog</a>',
            ].join(""),
            body: [
              "<h1>FixtureCo launch monitoring</h1>",
              "<p>Track public website updates with evidence.</p>",
              "<p>Trusted by 2,500 customers with 99.9% uptime and 24/7 support.</p>",
            ].join(""),
          }),
        );
        return;
      case "/packages":
        response(
          res,
          200,
          "text/html",
          html({
            title: "Packages",
            body: [
              "<h1>Packages</h1>",
              "<section><h2>Free</h2><p>Free forever</p></section>",
              "<section><h2>Starter</h2><p>Starter plan $19/mo</p></section>",
              "<section><h2>Business</h2><p>$49 per user/month billed annually</p></section>",
              "<section><h2>Enterprise</h2><p>Contact sales</p></section>",
            ].join(""),
          }),
        );
        return;
      case "/features":
        response(
          res,
          200,
          "text/html",
          html({
            title: "Features",
            body: [
              "<h1>Features</h1>",
              "<h2>Automated monitoring</h2><p>Track competitor pages on a schedule.</p>",
              "<h2>Pricing alerts</h2><p>Catch packaging and plan changes.</p>",
              "<h2>Evidence-backed summaries</h2><p>Every result links to public source text.</p>",
            ].join(""),
          }),
        );
        return;
      case "/release-notes":
        response(
          res,
          200,
          "text/html",
          html({
            title: "Release notes",
            body: [
              "<h1>Release notes</h1>",
              "<article><h2>May 1, 2026 - New alerts released</h2><p>Improved pricing monitoring.</p></article>",
              "<article><h2>April 12, 2026 - Fixed crawler retries</h2></article>",
            ].join(""),
          }),
        );
        return;
      case "/blog":
        response(
          res,
          200,
          "text/html",
          html({
            title: "Blog",
            body: "<h1>Company blog</h1><p>Lessons from customer research.</p><p>May 1, 2026</p>",
          }),
        );
        return;
      case "/spa":
        response(
          res,
          200,
          "text/html",
          "<!doctype html><html><head><title>SPA shell</title></head><body><div id=\"root\"></div><script src=\"/assets/app.js\"></script><script>window.__NEXT_DATA__={}</script><script>window.app={}</script><script>window.bundle={}</script><script>window.more={}</script></body></html>",
        );
        return;
      case "/sitemap.xml":
        response(
          res,
          200,
          "application/xml",
          `<?xml version="1.0"?><urlset><url><loc>http://${req.headers.host}/release-notes</loc></url><url><loc>http://${req.headers.host}/blog</loc></url></urlset>`,
        );
        return;
      case "/pricing":
        response(res, 404, "text/html", "<h1>Not found</h1>");
        return;
      default:
        response(res, 404, "text/html", "<h1>Not found</h1>");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function scrapedPage({
  url = "https://example.com/pricing",
  title = "Fixture page",
  rawText,
  links = [],
  pageModel,
}) {
  return {
    requestedUrl: url,
    finalUrl: url,
    title,
    metaDescription: `${title} meta`,
    status: 200,
    ok: true,
    rawText,
    hash: `hash:${title}:${rawText.length}`,
    links,
    ...(pageModel ? { pageModel } : {}),
  };
}

const checks = [];

function check(name, fn) {
  checks.push({ name, fn });
}

function fieldsHaveEvidence(facts) {
  for (const fact of facts) {
    assert.ok(fact.source_url, `${fact.field} missing source_url`);
    assert.ok(fact.evidence_text, `${fact.field} missing evidence_text`);
    assert.ok(fact.confidence, `${fact.field} missing confidence`);
  }
}

try {
  compileSources();
  const restoreResolver = installAliasResolver();
  const {
    parseCompetitorUrl,
    parseManualPageUrl,
  } = require(path.join(outDir, "src/lib/urls.js"));
  const { scrapePages } = require(path.join(
    outDir,
    "src/lib/crawler/scraper.js",
  ));
  const {
    buildPageModel,
    extractMeaningfulText,
  } = require(path.join(outDir, "src/lib/crawler/text.js"));
  const { analyzePricing } = require(path.join(
    outDir,
    "src/lib/intelligence/pricing.js",
  ));
  const { analyzePageIntelligence } = require(path.join(
    outDir,
    "src/lib/intelligence/analyze.js",
  ));
  const { discoverCompetitorPages } = require(path.join(
    outDir,
    "src/lib/crawler/discovery.js",
  ));
  const { summarizeIntelligence } = require(path.join(
    outDir,
    "src/lib/ai/intelligence-summary.js",
  ));
  const {
    buildSnapshotAnalysis,
    compareSnapshotAnalyses,
    normalizeForChangeDetection,
  } = require(path.join(outDir, "src/lib/change-detection.js"));

  check("normalizes bare domain", () => {
    const parsed = parseCompetitorUrl("example.com");
    assert.equal(parsed.baseUrl, "https://example.com");
    assert.equal(parsed.submittedPageUrl, undefined);
  });

  check("normalizes https domain", () => {
    const parsed = parseCompetitorUrl("https://example.com");
    assert.equal(parsed.baseUrl, "https://example.com");
    assert.equal(parsed.submittedUrl, "https://example.com/");
  });

  check("supports www domain", () => {
    const parsed = parseCompetitorUrl("www.example.com");
    assert.equal(parsed.baseUrl, "https://www.example.com");
  });

  check("normalizes subpage and strips tracking parameters", () => {
    const parsed = parseCompetitorUrl(
      "example.com/pricing/?utm_source=ad&plan=pro#gated",
    );
    assert.equal(parsed.baseUrl, "https://example.com");
    assert.equal(parsed.submittedPageUrl, "https://example.com/pricing?plan=pro");
  });

  check("manual page URLs stay on the same domain", () => {
    assert.equal(
      parseManualPageUrl("/plans/?utm_campaign=x", "https://example.com"),
      "https://example.com/plans",
    );
    assert.throws(
      () => parseManualPageUrl("https://other.example/pricing", "https://example.com"),
      /competitor domain/,
    );
  });

  check("rejects private hosts and non-public crawl paths", () => {
    assert.throws(() => parseCompetitorUrl("localhost:3000"), /public website/i);
    assert.throws(() => parseCompetitorUrl("127.0.0.1:3000"), /public website/i);
    assert.throws(
      () => parseCompetitorUrl("example.com/checkout"),
      /public marketing|product|pricing|docs|update/i,
    );
    assert.throws(
      () => parseManualPageUrl("/account", "https://example.com"),
      /public pages/i,
    );
  });

  check("detects reliable monthly EUR pricing", () => {
    const pricing = analyzePricing(
      scrapedPage({
        rawText: "Pricing\nStarter plan \u20AC5/month\nBilled monthly",
      }),
      "pricing",
    );
    assert.equal(pricing.status, "found");
    assert.equal(pricing.lowestPrice.normalized_value.amount, 5);
    assert.equal(pricing.lowestPrice.normalized_value.currency, "EUR");
    assert.equal(pricing.lowestPrice.normalized_value.period, "month");
    assert.equal(pricing.lowestPrice.confidence, "high");
    fieldsHaveEvidence(pricing.facts);
  });

  check("detects per-user USD pricing and contact sales", () => {
    const pricing = analyzePricing(
      scrapedPage({
        rawText:
          "Packages\nStarter $19/mo\nBusiness $49 per user/month\nEnterprise Contact sales",
      }),
      "pricing",
    );
    assert.equal(pricing.status, "found");
    assert.ok(pricing.paidPlans.some((fact) => fact.normalized_value.unit === "user"));
    assert.ok(pricing.contactSales);
    fieldsHaveEvidence(pricing.facts);
  });

  check("detects contact-sales-only pricing without inventing a price", () => {
    const pricing = analyzePricing(
      scrapedPage({
        rawText: "Enterprise pricing\nCustom packaging\nContact sales",
      }),
      "pricing",
    );
    assert.equal(pricing.status, "found");
    assert.equal(pricing.paidPlans.length, 0);
    assert.ok(pricing.contactSales);
  });

  check("does not mistake counts, uptime, support, or years for prices", () => {
    const pricing = analyzePricing(
      scrapedPage({
        rawText:
          "Trusted by 2,500 customers\n99.9% uptime\n24/7 support\nFounded in 2020\n100 integrations",
      }),
      "homepage",
    );
    assert.equal(pricing.status, "unavailable");
    assert.equal(pricing.paidPlans.length, 0);
  });

  check("detects pricing when it is only visible on homepage", () => {
    const pricing = analyzePricing(
      scrapedPage({
        url: "https://example.com/",
        rawText: "Plans\nStarter plan $29/mo\nStart free",
      }),
      "homepage",
    );
    assert.equal(pricing.status, "found");
    assert.equal(pricing.lowestPrice.normalized_value.amount, 29);
  });

  check("detects plan-selector pricing with unclear billing period", () => {
    const productHtml = html({
      title: "PropAI - Freelance Proposal Generator That Matches Your Voice",
      links: '<nav><a href="/login">Login to your dashboard</a></nav>',
      body: [
        "<section class=\"hero\"><h1>Freelance proposal generator that matches your voice</h1><p>Create personalized proposals from your writing samples for freelance clients.</p><a>Sign up free</a></section>",
        "<form class=\"plan-selector\"><h2>Plus</h2><p>100 proposals/week</p><button>Get Plus - \u20AC5</button></form>",
        "<section class=\"features\"><h2>Voice matching</h2><p>Generate proposals from your writing sample.</p><h2>Proposal generation</h2><p>Draft tailored client proposals fast.</p><h2>Personalized output</h2><p>Keep the wording close to your style.</p></section>",
      ].join(""),
    });
    const model = buildPageModel(productHtml, "https://getpropai.com/");
    const page = analyzePageIntelligence({
      pageType: "homepage",
      scrape: scrapedPage({
        url: "https://getpropai.com/",
        title: "PropAI - Freelance Proposal Generator That Matches Your Voice",
        rawText: extractMeaningfulText(productHtml),
        pageModel: model,
        links: model.blocks.flatMap((block) => block.links),
      }),
    });

    assert.equal(page.pricing.status, "found");
    assert.equal(page.pricing.lowestPrice.normalized_value.amount, 5);
    assert.equal(page.pricing.lowestPrice.normalized_value.currency, "EUR");
    assert.equal(page.pricing.lowestPrice.normalized_value.period, undefined);
    assert.match(page.pricing.lowestPrice.evidence_text, /\u20AC5|Get Plus/i);
    assert.match(page.positioning.homepageHeadline.value, /proposal generator/i);
    assert.doesNotMatch(page.positioning.homepageHeadline.value, /login|dashboard/i);
    assert.ok(page.ctas.ctas.some((cta) => /sign up free/i.test(cta.value)));
    assert.ok(page.features.features.some((feature) => /voice/i.test(feature.value)));
    assert.ok(page.pricing.debug.candidates.length >= 1);
    fieldsHaveEvidence(page.facts);
  });

  check("detects common V2 pricing patterns and rejects stats", () => {
    const plus = analyzePricing(
      scrapedPage({ rawText: "Plus\n100 proposals/week\nGet Plus - \u20AC5" }),
      "homepage",
    );
    const pro = analyzePricing(
      scrapedPage({ rawText: "Pricing\nPro \u20AC19/month\nBilled monthly" }),
      "pricing",
    );
    const stats = analyzePricing(
      scrapedPage({ rawText: "Trusted by 2,500 customers\n99.9% uptime\n24/7 support" }),
      "homepage",
    );

    assert.equal(plus.status, "found");
    assert.equal(plus.lowestPrice.normalized_value.amount, 5);
    assert.equal(pro.lowestPrice.normalized_value.amount, 19);
    assert.equal(pro.lowestPrice.normalized_value.period, "month");
    assert.equal(stats.status, "unavailable");
  });

  check("passes a 50-page deterministic SaaS fixture set", () => {
    const pricingFixtures = [
      ["Starter $9/mo", 9],
      ["Pro $29 per user/month", 29],
      ["Growth USD 49/month", 49],
      ["Basic 12 USD per month", 12],
      ["Launch \u20AC5/month", 5],
      ["Plus 5\u20AC/month", 5],
      ["Team EUR 25 per user/month", 25],
      ["Agency \u00A319/mo", 19],
      ["Scale GBP 79/month", 79],
      ["From \u20AC10", 10],
      ["Starting at $49", 49],
      ["Business $99 billed annually", 99],
      ["Annual plan $180/year", 180],
      ["Creator $15/mo billed monthly", 15],
      ["Premium $120 per year", 120],
      ["Plan table\nStarter\n$19/mo\nBusiness\n$49/mo", 19],
      ["Pricing card\nFree forever\nPro $20/month", 20],
      ["Upgrade modal\nGet Plus - \u20AC5", 5],
      ["Packages\nSolo $7/month\nTeam $14/month", 7],
      ["Subscription\nEssential EUR 11 / month", 11],
      ["Prix\nPro 15 EUR/mois", 15],
      ["Tarifs\nStarter \u20AC8 par mois", 8],
    ];
    const contactSalesFixtures = [
      "Enterprise pricing\nContact sales",
      "Custom plans\nTalk to sales",
      "Request pricing for your team",
      "Contact us for annual procurement",
      "Sales-led pricing\nBook a demo",
    ];
    const noPricingFixtures = [
      "Trusted by 2,500 customers",
      "99.9% uptime and 24/7 support",
      "100 integrations and 2020 founding story",
      "SOC2 compliant with 10,000 teams",
      "Used in 42 countries by 500 agencies",
      "API docs with 200 responses and 404 examples",
      "Customer story: revenue grew 300%",
      "Changelog May 1, 2026 fixed crawler retries",
      "About page with offices in 3 countries",
      "Support page with 24 hour response target",
    ];
    const positioningFixtures = [
      "AI analytics workspace for finance teams\nTurn messy revenue data into board-ready insights.",
      "Proposal automation for freelancers\nCreate client-ready proposals in your own voice.",
      "Privacy-first web analytics\nSimple website metrics without cookies.",
      "Incident management for engineering teams\nResolve outages faster with collaborative runbooks.",
      "Email API for developers\nSend transactional email at scale.",
    ];
    const ctaFixtures = [
      "Hero\nStart free\nBook a demo",
      "Hero\nGet started\nView pricing",
      "Hero\nStart trial\nContact sales",
      "Hero\nSign up free\nRead docs",
      "Hero\nDownload app\nLearn more",
    ];
    const featureFixtures = [
      "Features\nAutomated monitoring\nPricing alerts\nEvidence-backed summaries",
      "Features\nVoice matching\nProposal generation\nPersonalized output",
      "Features\nCookieless analytics\nGoal tracking\nDashboard sharing",
      "Features\nRunbooks\nEscalations\nStatus page updates",
      "Features\nEmail API\nWebhooks\nTemplate editor",
    ];
    const changelogFixtures = [
      "Release notes\nMay 1, 2026 - New dashboard shipped\nImproved pricing monitoring",
      "Changelog\nv2.4.0 released\nFixed alert delivery",
      "Updates\nApril 12, 2026 - API keys improved",
    ];
    const messyHtmlFixtures = [
      extractMeaningfulText("<nav>Login Dashboard</nav><main><section><h1>Pricing</h1><table><tr><td>Starter</td><td>$19/mo</td></tr></table></section></main><footer>Privacy</footer>"),
      extractMeaningfulText("<div class=\"modal\"><h2>Upgrade</h2><button>Get Plus - \u20AC5</button></div>"),
    ];
    const totalFixtures =
      pricingFixtures.length +
      contactSalesFixtures.length +
      noPricingFixtures.length +
      positioningFixtures.length +
      ctaFixtures.length +
      featureFixtures.length +
      changelogFixtures.length +
      messyHtmlFixtures.length;

    assert.ok(totalFixtures >= 50, `expected at least 50 fixtures, got ${totalFixtures}`);

    for (const [text, amount] of pricingFixtures) {
      const pricing = analyzePricing(scrapedPage({ rawText: `Pricing\n${text}` }), "pricing");
      assert.equal(pricing.status, "found", text);
      assert.equal(pricing.lowestPrice.normalized_value.amount, amount, text);
      fieldsHaveEvidence(pricing.facts);
    }

    for (const text of contactSalesFixtures) {
      const pricing = analyzePricing(scrapedPage({ rawText: text }), "pricing");
      assert.equal(pricing.status, "found", text);
      assert.ok(pricing.contactSales, text);
      assert.equal(pricing.paidPlans.length, 0, text);
    }

    for (const text of noPricingFixtures) {
      const pricing = analyzePricing(scrapedPage({ rawText: text }), "homepage");
      assert.equal(pricing.status, "unavailable", text);
      assert.equal(pricing.paidPlans.length, 0, text);
    }

    for (const text of positioningFixtures) {
      const page = analyzePageIntelligence({
        pageType: "homepage",
        scrape: scrapedPage({ rawText: text }),
      });
      assert.equal(page.positioning.status, "found", text);
      fieldsHaveEvidence(page.positioning.facts);
    }

    for (const text of ctaFixtures) {
      const page = analyzePageIntelligence({
        pageType: "homepage",
        scrape: scrapedPage({ rawText: text }),
      });
      assert.notEqual(page.ctas.status, "unavailable", text);
      fieldsHaveEvidence(page.ctas.ctas);
    }

    for (const text of featureFixtures) {
      const page = analyzePageIntelligence({
        pageType: "features",
        scrape: scrapedPage({ rawText: text }),
      });
      assert.ok(page.features.features.length >= 3, text);
      fieldsHaveEvidence(page.features.features);
    }

    for (const text of changelogFixtures) {
      const page = analyzePageIntelligence({
        pageType: "changelog",
        scrape: scrapedPage({ rawText: text }),
      });
      assert.equal(page.changelog.status, "found", text);
      fieldsHaveEvidence(page.facts);
    }

    for (const text of messyHtmlFixtures) {
      const pricing = analyzePricing(scrapedPage({ rawText: text }), "pricing");
      assert.equal(pricing.status, "found", text);
    }
  });

  check("page model extracts hero pricing cta and ignores nav", () => {
    const modeled = buildPageModel(
      html({
        title: "Modeled product",
        links: "<nav><a>Login</a><a>Dashboard</a></nav>",
        body: [
          "<section class=\"hero\"><h1>Proposal generator for freelancers</h1><a>Sign up free</a></section>",
          "<section class=\"pricing\"><h2>Plus</h2><button>Get Plus - \u20AC5</button></section>",
          "<footer>Privacy Terms</footer>",
        ].join(""),
      }),
      "https://example.com",
    );

    assert.ok(modeled.hero.text.includes("Proposal generator"));
    assert.equal(modeled.pricingBlocks.length >= 1, true);
    assert.equal(modeled.nav.length >= 1, true);
    assert.doesNotMatch(modeled.visibleContent, /Dashboard/);
  });

  check("detects changelog pages but not generic blog pages", () => {
    const changelog = analyzePageIntelligence({
      pageType: "changelog",
      scrape: scrapedPage({
        url: "https://example.com/release-notes",
        title: "Release notes",
        rawText:
          "Release notes\nMay 1, 2026 - New alerts released\nImproved pricing monitoring\nFixed crawler retries",
      }),
    });
    assert.equal(changelog.changelog.status, "found");
    fieldsHaveEvidence(changelog.facts);

    const blog = analyzePageIntelligence({
      pageType: "homepage",
      scrape: scrapedPage({
        url: "https://example.com/blog",
        title: "Blog",
        rawText: "Company blog\nLessons from customer research\nMay 1, 2026",
      }),
    });
    assert.equal(blog.changelog.status, "unavailable");
  });

  check("discovers same-domain pages and survives a failed candidate", async () => {
    await withFixtureSite(async (baseUrl) => {
      const pages = await discoverCompetitorPages(baseUrl);
      const byType = new Map(pages.map((page) => [page.pageType, page]));

      assert.ok(byType.get("homepage"), "homepage not discovered");
      assert.ok(byType.get("features"), "features page not discovered");
      assert.ok(byType.get("pricing")?.url.includes("/packages"), "packages pricing page not selected");
      assert.ok(byType.get("changelog")?.url.includes("/release-notes"), "release notes page not selected");
      assert.ok(!pages.some((page) => page.url.endsWith("/pricing")), "failed /pricing fallback was selected");
    });
  });

  check("marks JavaScript-heavy shells as limited static analysis", async () => {
    await withFixtureSite(async (baseUrl) => {
      const [spa] = await scrapePages([`${baseUrl}/spa`]);

      assert.equal(spa.javascriptHeavy, true);
      assert.equal(spa.ok, false);
      assert.match(
        [...(spa.warnings ?? []), spa.error ?? ""].join(" "),
        /JavaScript-heavy|Static analysis was limited/i,
      );
    });
  });

  check("summarizes only verified structured facts or limited data", async () => {
    const page = analyzePageIntelligence({
      pageType: "pricing",
      scrape: scrapedPage({
        rawText: "Pricing\nStarter plan $19/mo\nBook a demo",
      }),
    });
    const summary = await summarizeIntelligence({
      competitorName: "FixtureCo",
      pages: [page],
    });

    assert.equal(
      /is a saas product|offer software solutions|improve productivity/i.test(
        summary.executive_summary ?? "",
      ),
      false,
    );
    assert.ok(
      summary.pricing_summary?.includes("$19") ||
        summary.executive_summary?.includes("$19"),
      "summary should include verified pricing evidence",
    );

    const weakSummary = await summarizeIntelligence({
      competitorName: "FixtureCo",
      pages: [],
    });
    assert.equal(
      weakSummary.executive_summary,
      "Initial scan completed, but reliable public data was limited.",
    );
  });

  check("AI disabled still returns deterministic analysis without raw quota errors", async () => {
    process.env.ENABLE_AI_SUMMARIES = "false";
    process.env.OPENAI_API_KEY = "quota-exhausted-test-key";

    const page = analyzePageIntelligence({
      pageType: "pricing",
      scrape: scrapedPage({
        rawText: "Pricing\nPro \u20AC19/month\nSign up free",
      }),
    });
    const summary = await summarizeIntelligence({
      competitorName: "FixtureCo",
      pages: [page],
    });

    assert.equal(summary.source, "deterministic");
    assert.doesNotMatch(
      JSON.stringify(summary),
      /429|quota|exceeded your current quota/i,
    );

    delete process.env.ENABLE_AI_SUMMARIES;
    delete process.env.OPENAI_API_KEY;
  });

  function comparePage(previousText, nextText, pageType = "pricing") {
    const previous = buildSnapshotAnalysis({
      pageType,
      scrape: scrapedPage({ rawText: previousText }),
    });
    const current = buildSnapshotAnalysis({
      pageType,
      scrape: scrapedPage({ rawText: nextText }),
    });

    return compareSnapshotAnalyses({
      previousRawHash: previous.rawContentHash,
      previousCanonicalHash: previous.canonicalContentHash,
      previousStructuredFactsHash: previous.structuredFactsHash,
      previousFacts: previous.structuredFacts,
      previousCanonicalContent: previous.canonicalContent,
      current,
    });
  }

  check("normalizes cosmetic changes for meaningful change detection", () => {
    assert.equal(
      normalizeForChangeDetection("Start Free\n\u20AC 5 / month\nAI SaaS tool"),
      normalizeForChangeDetection("START FREE\n\u20AC5/month\nai saas tool"),
    );

    const result = comparePage(
      "Pricing\nStarter plan \u20AC 5 / month\nStart Free",
      "Pricing\nStarter plan \u20AC5/month\nSTART FREE",
    );

    assert.equal(result.meaningfulChanges.length, 0);
    assert.ok(result.ignoredReasons.length);
  });

  check("ignores nav footer cookie and reordered equivalent content", () => {
    const result = comparePage(
      "Pricing\nStarter plan $19/mo\nAccept cookies\nPrivacy policy\nBook demo",
      "Book demo\nPrivacy policy\nStarter plan $19/mo\nPricing\nCookie settings",
    );

    assert.equal(result.meaningfulChanges.length, 0);
  });

  check("detects meaningful pricing changes", () => {
    const result = comparePage(
      "Pricing\nStarter plan \u20AC5/month\nFree forever",
      "Pricing\nStarter plan \u20AC9/month",
    );
    const changeTypes = result.meaningfulChanges.map((change) => change.changeType);

    assert.ok(changeTypes.includes("lowest_price_changed"));
    assert.ok(changeTypes.includes("free_plan_removed"));
  });

  check("detects meaningful CTA positioning feature and changelog changes", () => {
    const cta = comparePage(
      "Home\nLaunch monitoring for freelancers\nStart free",
      "Home\nLaunch monitoring for agencies\nBook a demo",
      "homepage",
    );
    assert.ok(cta.meaningfulChanges.some((change) => change.changeType === "primary_cta_changed"));
    assert.ok(cta.meaningfulChanges.some((change) => change.changeType === "homepage_headline_changed"));

    const features = comparePage(
      "Features\nAutomation dashboard\nTrack workflows\nAnalytics reports\nSecurity alerts",
      "Features\nAutomation dashboard\nTrack workflows\nAnalytics reports\nSecurity alerts\nAPI integrations",
      "features",
    );
    assert.ok(features.meaningfulChanges.some((change) => change.changeType === "feature_added"));

    const changelog = comparePage(
      "Release notes\nApril 12, 2026 - Fixed crawler retries",
      "Release notes\nMay 1, 2026 - Stripe integration launched\nApril 12, 2026 - Fixed crawler retries",
      "changelog",
    );
    assert.ok(changelog.meaningfulChanges.some((change) => change.changeType === "new_changelog_entry"));
  });

  let passed = 0;

  for (const item of checks) {
    await item.fn();
    passed += 1;
    console.log(`PASS ${item.name}`);
  }

  restoreResolver();
  console.log(`\nPhase 11 checks passed: ${passed}/${checks.length}`);
} finally {
  await rm(outDir, { force: true, recursive: true });
}
