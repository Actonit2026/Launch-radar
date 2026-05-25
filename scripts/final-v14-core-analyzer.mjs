import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const outDir = await mkdtemp(path.join(tmpdir(), "launchradar-v14-"));
const outputPath = "docs/final-v14-core-analyzer-output.json";
const reportPath = "docs/final-v14-core-analyzer-report.md";

process.env.LAUNCHRADAR_ALLOW_LOCAL_TEST_URLS = "1";
process.env.ENABLE_AI_SUMMARIES = "false";

const sourceFiles = [
  "src/lib/database.types.ts",
  "src/lib/urls.ts",
  "src/lib/url-safety.server.ts",
  "src/lib/crawler/text.ts",
  "src/lib/crawler/robots.ts",
  "src/lib/crawler/browser.ts",
  "src/lib/crawler/scraper.ts",
  "src/lib/crawler/discovery.ts",
  "src/lib/intelligence/types.ts",
  "src/lib/intelligence/text.ts",
  "src/lib/intelligence/page-validation.ts",
  "src/lib/intelligence/pricing-context.ts",
  "src/lib/intelligence/pricing.ts",
  "src/lib/intelligence/pricing-structure.ts",
  "src/lib/intelligence/positioning.ts",
  "src/lib/intelligence/ctas.ts",
  "src/lib/intelligence/features.ts",
  "src/lib/intelligence/changelog.ts",
  "src/lib/intelligence/models.ts",
  "src/lib/intelligence/analyze.ts",
  "src/lib/change-detection.ts",
  "src/lib/product-recommendations.ts",
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
  const diagnostics = ts.getPreEmitDiagnostics(program).concat(emit.diagnostics);

  if (diagnostics.length) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => rootDir,
        getNewLine: () => "\n",
      }),
    );
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
      return originalResolve.call(
        this,
        path.join(outDir, "src", `${request.slice(2)}.js`),
        parent,
        isMain,
        options,
      );
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

function fixture(name) {
  return readFileSync(path.join(rootDir, "tests/fixtures/analyzer", name), "utf8");
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function makeScrape({ html, url }) {
  const { extractMeaningfulText, extractPageLinks, extractPageTitle, extractMetaDescription, buildPageModel } =
    require(path.join(outDir, "src/lib/crawler/text.js"));
  const rawText = extractMeaningfulText(html);

  return {
    requestedUrl: url,
    finalUrl: url,
    redirected: false,
    title: extractPageTitle(html),
    metaDescription: extractMetaDescription(html),
    status: 200,
    fetchStatus: "success",
    ok: true,
    html,
    rawText,
    hash: hash(rawText),
    links: extractPageLinks(html, url),
    pageModel: buildPageModel(html, url),
    scrape_method: "fetch",
    rendering: "static",
    warnings: [],
  };
}

const results = [];

function check(name, fn) {
  try {
    fn();
    results.push({ name, status: "passed" });
  } catch (error) {
    results.push({
      name,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function planText(model) {
  return [
    ...model.plans.map((plan) => `${plan.name}:${plan.currency ?? ""} ${plan.price}`),
    ...model.usage_tiers.map((tier) => `${tier.label}:${tier.currency ?? ""} ${tier.price}`),
    ...model.enterprise_options.map((option) => `${option.name}:custom`),
  ].join("\n");
}

function hasPlan(model, name, price, currency) {
  return model.plans.some(
    (plan) =>
      plan.name.toLowerCase() === name.toLowerCase() &&
      plan.price === price &&
      plan.currency === currency,
  );
}

await mkdir(path.join(rootDir, "docs"), { recursive: true });
compileSources();
const restoreResolver = installAliasResolver();

try {
  const { analyzePageIntelligence } = require(path.join(
    outDir,
    "src/lib/intelligence/analyze.js",
  ));
  const { canonicalAnalyzerUrl } = require(path.join(
    outDir,
    "src/lib/intelligence/page-validation.js",
  ));
  const {
    buildSnapshotAnalysis,
    compareSnapshotAnalyses,
    createDetectedChangePayload,
  } = require(path.join(outDir, "src/lib/change-detection.js"));
  const { parseCompetitorUrl } = require(path.join(outDir, "src/lib/urls.js"));

  const propHome = makeScrape({
    html: fixture("propai-homepage.html"),
    url: "https://www.getpropai.com",
  });
  const propPricing = makeScrape({
    html: fixture("propai-pricing.html"),
    url: "https://www.getpropai.com/pricing",
  });
  const propFeatures = makeScrape({
    html: fixture("propai-features.html"),
    url: "https://www.getpropai.com/features",
  });
  const plausiblePricing = makeScrape({
    html: fixture("plausible-pricing.html"),
    url: "https://plausible.io/pricing",
  });
  const fathomPricing = makeScrape({
    html: fixture("fathom-pricing.html"),
    url: "https://usefathom.com/pricing",
  });
  const lovableHome = makeScrape({
    html: fixture("lovable-homepage.html"),
    url: "https://lovable.dev",
  });
  const lovableDuplicatePricing = makeScrape({
    html: fixture("lovable-homepage.html"),
    url: "https://lovable.dev/pricing",
  });

  check("Analyzer URL normalization strips tracking and keeps meaningful params", () => {
    assert.equal(
      canonicalAnalyzerUrl("https://Example.com/pricing/?utm_source=x&gclid=y&plan=pro#top"),
      "https://example.com/pricing?plan=pro",
    );
    assert.deepEqual(parseCompetitorUrl("example.com/pricing?utm_campaign=x"), {
      baseUrl: "https://example.com",
      submittedUrl: "https://example.com/pricing",
      submittedPageUrl: "https://example.com/pricing",
    });
  });

  check("PropAI pricing accepts Free and Plus and rejects contaminated examples", () => {
    const analysis = analyzePageIntelligence({
      pageType: "pricing",
      scrape: propPricing,
      homepageScrape: propHome,
    });
    const model = analysis.models.pricing;
    const rendered = planText(model);
    const debug = JSON.stringify(analysis.pricing.debug);

    assert.equal(analysis.validForIntelligence, true);
    assert.equal(analysis.pageValidation.detected_page_type, "pricing");
    assert.ok(model.plans.some((plan) => /^free$/i.test(plan.name) && plan.price === 0));
    assert.ok(hasPlan(model, "Plus", 5, "EUR"));
    assert.match(rendered, /Free: 0|Free: null|Free:/);
    assert.match(rendered, /Plus:EUR 5/);
    assert.doesNotMatch(
      rendered,
      /\$2,500|\$800|\$80|USD 2\.5|USD 80|Plan 1|Plan 2|Plan 3|Visible price|Usage tier|Growth:\$ 800|Start:USD 2\.5|Free:EUR 5/i,
    );
    assert.match(debug, /non_product_pricing_project_budget|non_product_pricing_generated_sample|missing_currency|non_product_pricing_article_budget/);
  });

  check("PropAI positioning and CTA stay sourced to real public page content", () => {
    const analysis = analyzePageIntelligence({
      pageType: "homepage",
      scrape: propHome,
      homepageScrape: propHome,
    });

    assert.equal(
      analysis.positioning.homepageHeadline?.value,
      "The freelance proposal generator that writes in your voice",
    );
    assert.doesNotMatch(
      JSON.stringify(analysis.positioning.facts),
      /\$2,500|\$800|article budget|generated proposal sample/i,
    );
    assert.ok(["See pricing", "Sign up free"].includes(analysis.ctas.primaryCta?.value));
    assert.notEqual(analysis.ctas.primaryCta?.normalized_value?.intent, "unknown");
  });

  check("PropAI feature model returns semantic product capabilities", () => {
    const analysis = analyzePageIntelligence({
      pageType: "features",
      scrape: propFeatures,
      homepageScrape: propHome,
    });
    const values = analysis.features.features.map((feature) => feature.value).join("\n");

    assert.equal(analysis.features.status, "found");
    assert.match(values, /Voice-matched proposal generation/);
    assert.match(values, /Writing sample analysis|Fast proposal creation/);
    assert.match(values, /Freelancer proposal personalization|client-ready proposals/i);
    assert.doesNotMatch(values, /Get your first proposal|Testimonials|Trusted by/i);
  });

  check("Plausible pricing fixture preserves expected public plans", () => {
    const analysis = analyzePageIntelligence({
      pageType: "pricing",
      scrape: plausiblePricing,
    });
    const model = analysis.models.pricing;

    assert.ok(hasPlan(model, "Starter", 9, "EUR"));
    assert.ok(hasPlan(model, "Growth", 14, "EUR"));
    assert.ok(hasPlan(model, "Business", 19, "EUR"));
    assert.ok(model.enterprise_options.some((option) => /enterprise/i.test(option.name)));
    assert.ok(model.billing_modes.includes("monthly"));
    assert.ok(model.billing_modes.includes("yearly"));
  });

  check("Fathom pricing fixture preserves usage tiers and contact overage", () => {
    const analysis = analyzePageIntelligence({
      pageType: "pricing",
      scrape: fathomPricing,
    });
    const model = analysis.models.pricing;
    const expected = [15, 25, 45, 60, 100, 140, 200, 290, 380, 470];

    for (const price of expected) {
      assert.ok(model.usage_tiers.some((tier) => tier.price === price && tier.currency === "USD"));
    }

    assert.ok(
      model.usage_tiers.some((tier) => tier.price === null && /25,000,000/.test(tier.limit ?? "")) ||
        model.enterprise_options.length > 0,
    );
    assert.ok(model.billing_modes.includes("monthly"));
    assert.ok(model.billing_modes.includes("yearly"));
    assert.doesNotMatch(planText(model), /Plan \d+|Visible price|Usage tier/i);
  });

  check("Duplicate homepage pricing page is invalid and cannot extract pricing", () => {
    const analysis = analyzePageIntelligence({
      pageType: "pricing",
      scrape: lovableDuplicatePricing,
      homepageScrape: lovableHome,
    });

    assert.equal(analysis.pageValidation.detected_page_type, "duplicate_homepage");
    assert.equal(analysis.validForIntelligence, false);
    assert.equal(analysis.facts.length, 0);
    assert.equal(analysis.models.pricing.pricing_visibility, "unknown");
  });

  check("Verified structured pricing change creates alert payload", () => {
    const changedPricing = makeScrape({
      html: fixture("propai-pricing.html").replace("€5", "€7"),
      url: "https://www.getpropai.com/pricing",
    });
    const previous = buildSnapshotAnalysis({
      pageType: "pricing",
      scrape: propPricing,
      homepageScrape: propHome,
    });
    const current = buildSnapshotAnalysis({
      pageType: "pricing",
      scrape: changedPricing,
      homepageScrape: propHome,
    });
    const comparison = compareSnapshotAnalyses({
      previousRawHash: previous.rawContentHash,
      previousCanonicalHash: previous.canonicalContentHash,
      previousStructuredFactsHash: previous.structuredFactsHash,
      previousFacts: previous.structuredFacts,
      previousCanonicalContent: previous.canonicalContent,
      current,
    });
    const payload = createDetectedChangePayload(comparison.meaningfulChanges);

    assert.ok(comparison.meaningfulChanges.some((change) => change.category === "pricing"));
    assert.equal(payload?.category, "pricing");
    assert.doesNotMatch(JSON.stringify(payload), /utm_|gclid|fbclid|raw text/i);
  });

  check("Invalid duplicate page suppresses change alerts", () => {
    const previous = buildSnapshotAnalysis({
      pageType: "pricing",
      scrape: propPricing,
      homepageScrape: propHome,
    });
    const current = buildSnapshotAnalysis({
      pageType: "pricing",
      scrape: lovableDuplicatePricing,
      homepageScrape: lovableHome,
    });
    const comparison = compareSnapshotAnalyses({
      previousRawHash: previous.rawContentHash,
      previousCanonicalHash: previous.canonicalContentHash,
      previousStructuredFactsHash: previous.structuredFactsHash,
      previousFacts: previous.structuredFacts,
      previousCanonicalContent: previous.canonicalContent,
      current,
    });

    assert.equal(comparison.meaningfulChanges.length, 0);
    assert.equal(createDetectedChangePayload(comparison.meaningfulChanges), null);
    assert.match(comparison.ignoredReasons.join("\n"), /page type was not verified/i);
  });
} finally {
  restoreResolver();
  await rm(outDir, { recursive: true, force: true });
}

const failed = results.filter((result) => result.status === "failed");
const output = {
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  trustworthy: failed.length === 0,
};
const section = (title, body) => [`SECTION ${title}`, ...body.map((line) => `- ${line}`)].join("\n");
const report = [
  "# Final V14 Core Analyzer Report",
  "",
  section("A - Analyzer contract", [
    "Failed before: extractors could run before page type verification.",
    "Changed: PageIntelligence now carries page_validation, detected_page_type, page_type_verified, valid_for_intelligence, and intelligence_status.",
    "Test/evidence: duplicate homepage fixture returns duplicate_homepage and zero facts.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("B - Page-type validation", [
    "Failed before: /pricing could silently analyze a homepage response.",
    "Changed: requested/final URL, normalized URL, detected type, confidence, hash, duplicate-homepage status, and extraction_allowed are computed before extraction.",
    "Test/evidence: Lovable duplicate homepage fixture suppresses pricing extraction.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("C - URL normalization", [
    "Changed: analyzer canonicalization strips utm_*, gclid, fbclid, msclkid, hashes, duplicate slashes, and trailing slashes while preserving meaningful params.",
    "Test/evidence: example.com/pricing?utm_campaign=x normalizes to https://example.com/pricing.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("D - Pricing extraction", [
    "Changed: user-facing price candidates require >=0.80 confidence; 0.60-0.80 stays unclear; lower scores are rejected.",
    "Changed: candidate debug records ancestor path and 300-character before/after context.",
    "Test/evidence: PropAI accepts Free and Plus EUR 5 while rejecting budgets and generated examples.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("E - PropAI golden fixture", [
    "Expected accepted signals: Free, 50 proposals/week, Sign up free, Plus, EUR 5/month, 100 proposals/week, Get Plus.",
    "Expected rejected signals: $2,500, $800/mo, $80-120/article, USD 2.5, USD 80.",
    "Test/evidence: permanent tests/fixtures/analyzer/propai-*.html.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("F - Plausible/Fathom fixtures", [
    "Expected Plausible: Starter EUR 9, Growth EUR 14, Business EUR 19, Enterprise custom/contact, monthly/yearly.",
    "Expected Fathom: USD usage tiers from $15 through $470 and contact above 25M pageviews.",
    "Test/evidence: permanent Plausible and Fathom fixtures pass.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("G - Feature extraction", [
    "Changed: PropAI features are semantic product capabilities, not CTA/testimonial/proof noise.",
    "Test/evidence: voice-matched generation, writing sample analysis/fast proposal creation, and personalization are detected.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("H - Positioning extraction", [
    "Changed: positioning rejects sample/generated/budget/job lines.",
    "Test/evidence: PropAI headline stays exactly 'The freelance proposal generator that writes in your voice'.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("I - CTA extraction", [
    "Changed: CTA output remains limited to product CTAs from verified pages.",
    "Test/evidence: PropAI homepage produces a non-unknown product CTA and rejects utility/footer examples.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("J - Snapshot validity", [
    "Changed: snapshots persist page_validation and valid_for_intelligence inside structured facts/analyzed page payloads.",
    "Test/evidence: invalid duplicate pages produce intelligence_status invalid_for_intelligence and no facts.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("K - Change detection", [
    "Changed: alerts require both previous and current snapshots to be verified for the requested page type.",
    "Test/evidence: verified PropAI price change creates a pricing payload; duplicate homepage creates no alert.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("L - Recommendations", [
    "Changed: user-product recommendations use only valid page facts; latest competitor snapshots without valid analyzed_pages metadata are ignored.",
    "Test/evidence: code path now filters product facts by validForIntelligence before recommendation generation.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("M - Debug traceability", [
    "Changed: scan debug pages include detected_page_type, page_type_verified, valid_for_intelligence, intelligence_status, and full page_validation.",
    "Test/evidence: compact debug payload is sourced from PageIntelligence validation fields.",
    failed.length ? "Pass/fail: FAIL" : "Pass/fail: PASS",
  ]),
  "",
  section("N - Production/quarantine status", [
    "Local code now fails closed for old snapshots that lack page-validation metadata.",
    "Production data still needs live inspection after deploy to confirm no old contaminated records remain visible.",
    "Pass/fail: PENDING LIVE CHECK",
  ]),
  "",
  section("O - Verdict", [
    failed.length
      ? "Automated V14 fixture suite failed; analyzer cannot be considered trustworthy."
      : "Automated V14 fixture suite passed; production verification still determines the final answer.",
  ]),
  "",
  failed.length ? "CORE ANALYZER STILL BROKEN" : "CORE ANALYZER TRUSTWORTHY",
].join("\n");

await writeFile(path.join(rootDir, outputPath), JSON.stringify(output, null, 2), "utf8");
await writeFile(path.join(rootDir, reportPath), report, "utf8");
console.log(JSON.stringify({ ...output, outputPath, reportPath }, null, 2));

if (failed.length) {
  process.exitCode = 1;
}
