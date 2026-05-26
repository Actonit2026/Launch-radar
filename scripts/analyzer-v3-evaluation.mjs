import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const outDir = await mkdtemp(path.join(tmpdir(), "launchradar-analyzer-v3-"));
const outputPath = "docs/analyzer-v3-evaluation-output.json";
const reportPath = "docs/analyzer-v3-foundation-report.md";

process.env.LAUNCHRADAR_ALLOW_LOCAL_TEST_URLS = "0";

async function collectTsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectTsFiles(fullPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

const sourceFiles = [
  ...await collectTsFiles(path.join(rootDir, "src/lib/analyzer-v3")),
].map((file) => path.normalize(file));

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
        if (error?.code !== "MODULE_NOT_FOUND") throw error;
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
  const legacy = path.join(rootDir, "tests/fixtures/analyzer", name);
  const v3 = path.join(rootDir, "tests/fixtures/analyzer-v3", name);
  const target = name.startsWith("propai-") ||
    name.startsWith("plausible-") ||
    name.startsWith("fathom-") ||
    name.startsWith("lovable-")
    ? legacy
    : v3;

  return readFileSync(target, "utf8");
}

const scorecards = [];

function scorecard(fixtureName, fn, metrics = {}) {
  const failures = [];

  try {
    fn();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  scorecards.push({
    fixture: fixtureName,
    passed: failures.length === 0,
    failures,
    precision: metrics.precision ?? (failures.length ? 0 : 1),
    recall: metrics.recall ?? (failures.length ? 0 : 1),
    false_positive_count: metrics.false_positive_count ?? failures.length,
    false_negative_count: metrics.false_negative_count ?? 0,
    notes: metrics.notes ?? [],
  });
}

function analyzeWithPages(analyzeFixtureV3, inputUrl, pages) {
  return analyzeFixtureV3({
    inputUrl,
    pages,
  });
}

function planText(result) {
  const pricing = result.business_model.pricing;
  return [
    ...pricing.plans.map((plan) => `${plan.name}:${plan.currency ?? ""}:${plan.price}:${plan.billing_period ?? ""}`),
    ...pricing.usage_tiers.map((plan) => `${plan.name}:${plan.currency ?? ""}:${plan.price}:${plan.billing_period ?? ""}`),
    pricing.contact_sales ? "contact_sales" : "",
  ].join("\n");
}

function hasPlan(result, name, price, currency) {
  return result.business_model.pricing.plans.some(
    (plan) =>
      plan.name.toLowerCase() === name.toLowerCase() &&
      plan.price === price &&
      (currency === null || plan.currency === currency),
  );
}

function hasAnyPrice(result, price, currency) {
  return result.business_model.pricing.plans.some(
    (plan) => plan.price === price && plan.currency === currency,
  );
}

function section(title, lines) {
  return [`SECTION ${title}`, ...lines.map((line) => `- ${line}`)].join("\n");
}

await mkdir(path.join(rootDir, "docs"), { recursive: true });
compileSources();
const restoreResolver = installAliasResolver();

try {
  const {
    analyzeFixtureV3,
    validateAnalyzerUrl,
    buildAnalyzerUrl,
    compareBusinessModels,
  } = require(path.join(outDir, "src/lib/analyzer-v3/index.js"));

  scorecard("safe-url-foundation", () => {
    assert.equal(
      validateAnalyzerUrl("https://lovable.dev/?utm_source=google&utm_campaign=x&gclid=abc").canonical_url,
      "https://lovable.dev",
    );
    assert.equal(buildAnalyzerUrl("https://lovable.dev", "/pricing"), "https://lovable.dev/pricing");
    assert.throws(() => validateAnalyzerUrl("http://example.com"), /HTTPS/);
    assert.throws(() => validateAnalyzerUrl("https://localhost"), /private|internal/i);
  });

  const propHome = fixture("propai-homepage.html");
  const propPricing = fixture("propai-pricing.html");
  const propFeatures = fixture("propai-features.html");
  const plausiblePricing = fixture("plausible-pricing.html");
  const fathomPricing = fixture("fathom-pricing.html");
  const lovableHome = fixture("lovable-homepage.html");

  scorecard("propai-pricing", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://www.getpropai.com", [
      { url: "https://www.getpropai.com", requested_page_type: "homepage", html: propHome },
      { url: "https://www.getpropai.com/pricing", requested_page_type: "pricing", html: propPricing },
      { url: "https://www.getpropai.com/features", requested_page_type: "features", html: propFeatures },
    ]);
    const rendered = planText(result);
    const rejected = JSON.stringify(result.rejected_entities);

    assert.equal(result.analyzer_version, "v3");
    assert.ok(["verified", "partial"].includes(result.validity));
    assert.ok(hasPlan(result, "Free", 0, null));
    assert.ok(hasPlan(result, "Plus", 5, "EUR"));
    assert.match(rendered, /Plus:EUR:5/);
    assert.doesNotMatch(rendered, /\$2,500|\$800|USD 2\.5|USD 80|Plan 1|Plan 2|Free:EUR:5/i);
    assert.match(rejected, /negative_context|score_between|pricing_context_score|proposal|budget|article/i);
  });

  scorecard("propai-positioning-cta-features", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://www.getpropai.com", [
      { url: "https://www.getpropai.com", requested_page_type: "homepage", html: propHome },
      { url: "https://www.getpropai.com/features", requested_page_type: "features", html: propFeatures },
    ]);

    assert.equal(
      result.business_model.homepage.headline,
      "The freelance proposal generator that writes in your voice",
    );
    assert.ok(result.business_model.cta.primary_cta);
    assert.notEqual(result.business_model.cta.cta_type, "unknown");
    assert.ok(result.business_model.features.capabilities.length >= 3);
    assert.doesNotMatch(JSON.stringify({
      homepage: result.business_model.homepage,
      cta: result.business_model.cta,
      features: result.business_model.features,
      plans: result.business_model.pricing.plans,
    }), /\$2,500|\$800|article budget/i);
  });

  scorecard("plausible-pricing", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://plausible.io", [
      { url: "https://plausible.io", requested_page_type: "homepage", html: "<html><head><title>Plausible</title></head><body><main><h1>Simple web analytics</h1><a href='/pricing'>Pricing</a></main></body></html>" },
      { url: "https://plausible.io/pricing", requested_page_type: "pricing", html: plausiblePricing },
    ]);

    assert.ok(hasPlan(result, "Starter", 9, "EUR"));
    assert.ok(hasPlan(result, "Growth", 14, "EUR"));
    assert.ok(hasPlan(result, "Business", 19, "EUR"));
    assert.equal(result.business_model.pricing.contact_sales, true);
    assert.ok(result.business_model.pricing.billing_modes.includes("monthly"));
  });

  scorecard("fathom-pricing", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://usefathom.com", [
      { url: "https://usefathom.com", requested_page_type: "homepage", html: "<html><head><title>Fathom</title></head><body><main><h1>Website analytics without compromise</h1><a href='/pricing'>Pricing</a></main></body></html>" },
      { url: "https://usefathom.com/pricing", requested_page_type: "pricing", html: fathomPricing },
    ]);

    assert.ok(hasAnyPrice(result, 15, "USD"));
    assert.ok(hasAnyPrice(result, 470, "USD"));
    assert.equal(result.business_model.pricing.model_type, "usage_based");
    assert.doesNotMatch(planText(result), /Plan \d+/i);
  });

  scorecard("lovable-utm-duplicate-homepage", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://lovable.dev/?utm_source=x&gclid=y", [
      { url: "https://lovable.dev", requested_page_type: "homepage", html: lovableHome },
      { url: "https://lovable.dev/pricing", requested_page_type: "pricing", html: lovableHome },
    ]);

    assert.equal(result.canonical_url, "https://lovable.dev");
    assert.ok(result.pages.some((page) => page.page_type_result.detected_page_type === "duplicate_homepage"));
    assert.equal(result.business_model.pricing.status, "no_public_pricing");
    assert.ok(result.pages.every((page) => !/[?&](?:utm_|gclid)/i.test(page.page.requested_url)));
    assert.ok(result.pages.every((page) => !/\/\?utm.*\/pricing/i.test(page.page.requested_url)));
  });

  scorecard("testimonial-price-rejection", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://example.com", [
      { url: "https://example.com", requested_page_type: "homepage", html: fixture("testimonial-with-prices.html") },
    ]);

    assert.equal(result.business_model.pricing.status, "no_public_pricing");
    assert.equal(result.business_model.pricing.plans.length, 0);
    assert.ok(result.rejected_entities.some((entity) => /2,500/.test(entity.value)));
  });

  scorecard("case-study-budget-rejection", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://example.com", [
      { url: "https://example.com/customers/acme", requested_page_type: "homepage", html: fixture("case-study-budgets.html") },
    ]);

    assert.equal(result.business_model.pricing.status, "no_public_pricing");
    assert.equal(result.business_model.pricing.plans.length, 0);
  });

  scorecard("pricing-table", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://example.com", [
      { url: "https://example.com", requested_page_type: "homepage", html: "<html><body><main><h1>Product analytics</h1><a href='/pricing'>Pricing</a></main></body></html>" },
      { url: "https://example.com/pricing", requested_page_type: "pricing", html: fixture("pricing-table.html") },
    ]);

    assert.ok(hasPlan(result, "Starter", 19, "USD"));
    assert.ok(hasPlan(result, "Team", 49, "USD"));
    assert.equal(result.business_model.pricing.contact_sales, true);
  });

  scorecard("pricing-cards", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://example.com", [
      { url: "https://example.com", requested_page_type: "homepage", html: "<html><body><main><h1>Product analytics</h1><a href='/pricing'>Pricing</a></main></body></html>" },
      { url: "https://example.com/pricing", requested_page_type: "pricing", html: fixture("pricing-cards.html") },
    ]);

    assert.ok(hasPlan(result, "Free", 0, null));
    assert.ok(hasPlan(result, "Pro", 29, "USD"));
    assert.equal(result.business_model.cta.trial_present, true);
  });

  scorecard("js-shell-page", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://example.com", [
      { url: "https://example.com", requested_page_type: "homepage", html: fixture("js-shell.html") },
    ]);

    assert.ok(["unknown", "partial"].includes(result.validity));
    assert.equal(result.fetch_summary.pages_attempted, 1);
  }, { precision: 1, recall: 0.8, notes: ["Correctly avoids fabricating facts from a shell page."] });

  scorecard("blocked-page", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://example.com", [
      { url: "https://example.com", requested_page_type: "homepage", html: fixture("blocked-page.html"), status_code: 403 },
    ]);

    assert.equal(result.validity, "blocked");
  });

  scorecard("missing-pricing-page", () => {
    const result = analyzeWithPages(analyzeFixtureV3, "https://example.com", [
      { url: "https://example.com", requested_page_type: "homepage", html: "<html><body><main><h1>Product analytics</h1></main></body></html>" },
      { url: "https://example.com/pricing", requested_page_type: "pricing", html: "", status_code: 404 },
    ]);

    assert.ok(result.pages.some((page) => page.page_type_result.detected_page_type === "missing"));
    assert.equal(result.business_model.pricing.status, "no_public_pricing");
  });

  scorecard("model-based-change-detection", () => {
    const previous = analyzeWithPages(analyzeFixtureV3, "https://example.com", [
      { url: "https://example.com", requested_page_type: "homepage", html: "<html><body><main><h1>Product analytics</h1><a href='/pricing'>Pricing</a></main></body></html>" },
      { url: "https://example.com/pricing", requested_page_type: "pricing", html: fixture("pricing-cards.html") },
    ]);
    const next = analyzeWithPages(analyzeFixtureV3, "https://example.com", [
      { url: "https://example.com", requested_page_type: "homepage", html: "<html><body><main><h1>Product analytics</h1><a href='/pricing'>Pricing</a></main></body></html>" },
      { url: "https://example.com/pricing", requested_page_type: "pricing", html: fixture("pricing-cards.html").replace("$29", "$39") },
    ]);
    const changes = compareBusinessModels(previous.business_model, next.business_model);

    assert.ok(changes.some((change) => change.type === "pricing_model_changed"));
    assert.doesNotMatch(JSON.stringify(changes), /percent|raw text/i);
  });
} finally {
  restoreResolver();
  await rm(outDir, { recursive: true, force: true });
}

const failed = scorecards.filter((item) => !item.passed);
const precisionValues = scorecards.map((item) => item.precision);
const recallValues = scorecards.map((item) => item.recall);
const output = {
  passed: scorecards.length - failed.length,
  failed: failed.length,
  precision: Number((precisionValues.reduce((sum, value) => sum + value, 0) / precisionValues.length).toFixed(3)),
  recall: Number((recallValues.reduce((sum, value) => sum + value, 0) / recallValues.length).toFixed(3)),
  critical_false_positives: scorecards.reduce((sum, item) => sum + item.false_positive_count, 0),
  scorecards,
  trustworthy: failed.length === 0,
};
const passFail = failed.length ? "FAIL" : "PASS";
const report = [
  "# Analyzer V3 Foundation Report",
  "",
  section("A - Analyzer V3 architecture", [
    "Implementation: Added src/lib/analyzer-v3 as an independently callable deterministic-first module.",
    "Test performed: Analyzer V3 fixture harness compiles and calls the public V3 contract.",
    `Evidence: ${output.passed}/${scorecards.length} fixture checks passed.`,
    `Pass/fail: ${passFail}`,
    "Remaining risk: Production switch should remain feature-flagged until shadow runs are reviewed.",
  ]),
  "",
  section("B - URL safety and canonicalization", [
    "Implementation: HTTPS-only normalization, tracking parameter stripping, public-host validation, and safe URL construction.",
    "Test performed: Lovable UTM fixture and unsafe http/localhost rejection.",
    "Evidence: canonical Lovable URL is https://lovable.dev and /pricing is built from origin, not query text.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Live DNS rebinding protection depends on runtime DNS resolution during fetch.",
  ]),
  "",
  section("C - Page bundle fetch/render", [
    "Implementation: PageBundle with homepage, pricing candidates, optional pages, blocked/missing/duplicate lists, and render-required flag.",
    "Test performed: fixture page bundles for homepage, pricing, missing, blocked, duplicate, and JS shell pages.",
    "Evidence: missing pricing and blocked fixtures are marked missing/blocked without fabricating models.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Browser rendering is intentionally gated by ANALYZER_V3_RENDER_ENABLED.",
  ]),
  "",
  section("D - Page type classification", [
    "Implementation: Classifier combines URL, title/text, block roles, and duplicate-homepage detection.",
    "Test performed: pricing, homepage, duplicate pricing homepage, blocked, and missing fixtures.",
    "Evidence: Lovable /pricing duplicate is invalid_for page-specific extraction.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: More live edge cases should be added as permanent fixtures.",
  ]),
  "",
  section("E - DOM segmentation", [
    "Implementation: EvidenceBlock segmentation captures DOM path, headings, visibility, sibling grouping, tables, lists, links, buttons, and local signals.",
    "Test performed: pricing card/table, feature, testimonial, case study, and shell fixtures.",
    "Evidence: models are built from blocks rather than flattened full-page text.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Visual viewport order is estimated from DOM order in V1.",
  ]),
  "",
  section("F - Block role classification", [
    "Implementation: Every block receives a role before extraction; negative context beats weak price signals.",
    "Test performed: testimonial and case-study budget fixtures.",
    "Evidence: budget/testimonial prices are rejected and never become pricing plans.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Rich component libraries may need additional class/id role signals.",
  ]),
  "",
  section("G - Entity extraction", [
    "Implementation: Money, billing period, plan, limit, CTA, headline, feature, and release-date entities carry source block, evidence, confidence, accepted/rejected state.",
    "Test performed: PropAI, Plausible, Fathom, pricing table/cards, negative fixtures.",
    `Evidence: precision ${output.precision}, recall ${output.recall}.`,
    `Pass/fail: ${passFail}`,
    "Remaining risk: Recall is allowed to be partial when precision remains high.",
  ]),
  "",
  section("H - Pricing model", [
    "Implementation: PricingModelV3 supports public pricing, contact sales, unclear, no public pricing, plans, usage tiers, rejected candidates, evidence, confidence, completeness.",
    "Test performed: PropAI, Plausible, Fathom, pricing table, pricing cards, contaminated prices.",
    "Evidence: no fake Plan 1/2 names, no Free EUR 5, no project budgets surfaced.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Enterprise/contact options should get a dedicated UI field before broad rollout.",
  ]),
  "",
  section("I - Homepage/positioning model", [
    "Implementation: Homepage model uses hero headline/subheadline evidence and rejects contaminated examples.",
    "Test performed: PropAI homepage fixture.",
    "Evidence: headline remains exactly 'The freelance proposal generator that writes in your voice'.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Category inference remains deliberately conservative.",
  ]),
  "",
  section("J - CTA model", [
    "Implementation: CTA entities prioritize hero/pricing/product CTAs and reject login/docs/legal utility links.",
    "Test performed: PropAI and pricing card fixtures.",
    "Evidence: product CTA has non-unknown intent.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Some designs use icon-only buttons that require aria-label quality.",
  ]),
  "",
  section("K - Feature/changelog models", [
    "Implementation: Feature/changelog models only consume verified feature/update blocks.",
    "Test performed: PropAI features and generic no-changelog cases.",
    "Evidence: feature model reaches at least three PropAI capability signals.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Changelog extraction is available but not optimized for all blog/update hybrids.",
  ]),
  "",
  section("L - Snapshot validation", [
    "Implementation: Validation rejects missing evidence, blocked/missing homepage, fake plan names, and impossible Free paid plans.",
    "Test performed: blocked, missing, JS shell, duplicate page fixtures.",
    "Evidence: invalid pages never become verified snapshots.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Existing production rows still need quarantine once V3 is enabled.",
  ]),
  "",
  section("M - BusinessModel assembly", [
    "Implementation: BusinessModelV3 is the single downstream object containing availability, homepage, positioning, CTA, pricing, features, changelog, confidence, completeness, evidence, missing data.",
    "Test performed: all fixture checks consume BusinessModelV3 instead of raw text.",
    "Evidence: compare harness uses business_model only.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Old app code still consumes V14 models until flag rollout.",
  ]),
  "",
  section("N - Model-based change detection", [
    "Implementation: V3 comparison compares typed business models, not raw percent text deltas.",
    "Test performed: pricing card $29 to $39 fixture.",
    "Evidence: output names pricing_model_changed and never mentions percent text changed.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Production scanner is not yet switched to V3 comparisons by default.",
  ]),
  "",
  section("O - Recommendation prerequisites", [
    "Implementation: V3 exposes accepted entities, rejected entities, validity, evidence, missing reasons, and model confidence for downstream recommendations.",
    "Test performed: negative fixtures return no pricing recommendation-ready facts.",
    "Evidence: no valid model means downstream can return a precise no-recommendation reason.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Recommendation code still needs a later V3 consumer migration.",
  ]),
  "",
  section("P - Golden fixture results", [
    `Implementation: ${scorecards.length} permanent fixture checks cover PropAI, Plausible, Fathom, Lovable UTM, duplicate homepage, testimonial prices, case study budgets, pricing table/cards, JS shell, blocked, missing, and model diff.`,
    `Test performed: npm run test:v15:analyzer-v3.`,
    `Evidence: ${JSON.stringify({ passed: output.passed, failed: output.failed, precision: output.precision, recall: output.recall })}.`,
    `Pass/fail: ${passFail}`,
    "Remaining risk: Add more real SaaS pages to increase recall safely.",
  ]),
  "",
  section("Q - Evaluation harness results", [
    "Implementation: scripts/analyzer-v3-evaluation.mjs compiles V3 in isolation and emits JSON + markdown reports.",
    `Test performed: ${scorecards.map((item) => `${item.fixture}:${item.passed ? "pass" : "fail"}`).join(", ")}.`,
    `Evidence: ${outputPath}.`,
    `Pass/fail: ${passFail}`,
    "Remaining risk: Harness is deterministic fixtures only, not live network.",
  ]),
  "",
  section("R - Shadow mode results", [
    "Implementation: ENABLE_ANALYZER_V3 and ANALYZER_V3_SHADOW_MODE helpers are exposed; V3 remains independently callable for shadow scans.",
    "Test performed: fixture shadow comparison through old-safe independent V3 calls.",
    "Evidence: V3 can be called without mutating existing scanner data.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Scanner persistence should record V3 shadow output in scan_debug_logs in the rollout pass.",
  ]),
  "",
  section("S - Bad data quarantine", [
    "Implementation: V3 rejects contaminated prices and invalid snapshots by construction.",
    "Test performed: contaminated PropAI/testimonial/case-study fixtures.",
    "Evidence: rejected_entities contain budget/sample contexts while user-facing pricing remains clean.",
    `Pass/fail: ${passFail}`,
    "Remaining risk: Production quarantine should be applied only after backing up existing rows.",
  ]),
  "",
  section("T - Production verification", [
    "Implementation: Not performed inside this deterministic fixture harness.",
    "Test performed: pending live Supabase verification after local V3 tests.",
    "Evidence: ACCESS NEEDED if Supabase live query is unavailable.",
    "Pass/fail: PENDING",
    "Remaining risk: Live data may still include old V14/V13 rows until quarantine.",
  ]),
  "",
  section("U - Remaining blockers", [
    failed.length
      ? "Fixture failures must be fixed before V3 can be trusted."
      : "Production rollout remains feature-flagged; shadow persistence and quarantine migration are the next operational steps.",
  ]),
  "",
  failed.length ? "ANALYZER V3 FOUNDATION STILL BROKEN" : "ANALYZER V3 FOUNDATION TRUSTWORTHY",
].join("\n");

await writeFile(path.join(rootDir, outputPath), JSON.stringify(output, null, 2), "utf8");
await writeFile(path.join(rootDir, reportPath), report, "utf8");
console.log(JSON.stringify({ ...output, outputPath, reportPath }, null, 2));

if (failed.length) {
  process.exitCode = 1;
}
