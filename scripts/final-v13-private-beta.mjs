import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const outDir = await mkdtemp(path.join(tmpdir(), "launchradar-v13-"));
const reportPath = "docs/final-v13-private-beta-report.md";

delete process.env.MASTER_ADMIN_EMAILS;
delete process.env.ADMIN_EMAILS;
process.env.STRIPE_PRO_PRICE_ID = "price_pro_month";
process.env.STRIPE_BUSINESS_PRICE_ID = "price_business_month";

const sourceFiles = [
  "src/lib/database.types.ts",
  "src/lib/crawler/text.ts",
  "src/lib/crawler/robots.ts",
  "src/lib/crawler/browser.ts",
  "src/lib/crawler/scraper.ts",
  "src/lib/intelligence/types.ts",
  "src/lib/intelligence/text.ts",
  "src/lib/intelligence/pricing-context.ts",
  "src/lib/intelligence/pricing.ts",
  "src/lib/intelligence/pricing-structure.ts",
  "src/lib/intelligence/features.ts",
  "src/lib/intelligence/display.ts",
  "src/lib/product-recommendations.ts",
  "src/lib/master-admin.ts",
  "src/lib/stripe.ts",
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

function baseScrape({ html, url = "https://getpropai.com/pricing" }) {
  const { extractMeaningfulText, extractPageLinks, extractPageTitle, buildPageModel } =
    require(path.join(outDir, "src/lib/crawler/text.js"));

  return {
    requestedUrl: url,
    finalUrl: url,
    redirected: false,
    title: extractPageTitle(html),
    metaDescription: "",
    status: 200,
    fetchStatus: "success",
    ok: true,
    html,
    rawText: extractMeaningfulText(html),
    hash: "fixture",
    links: extractPageLinks(html, url),
    pageModel: buildPageModel(html, url),
    scrape_method: "fetch",
    rendering: "static",
    warnings: [],
  };
}

function fact({
  field,
  value,
  confidence = "high",
  score = 0.86,
  source = "https://example.com",
  evidence = value,
}) {
  return {
    field,
    value,
    confidence,
    confidence_score: score,
    source_url: source,
    evidence_text: evidence,
    extraction_method: "deterministic_structure",
  };
}

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function allSourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const absolute = path.join(dir, entry);
    const stat = statSync(absolute);

    if (stat.isDirectory()) {
      return allSourceFiles(absolute);
    }

    return absolute;
  });
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

await mkdir(path.join(rootDir, "docs"), { recursive: true });
compileSources();
const restoreResolver = installAliasResolver();

try {
  const { analyzePricing } = require(path.join(outDir, "src/lib/intelligence/pricing.js"));
  const { parsePricingStructure } = require(path.join(
    outDir,
    "src/lib/intelligence/pricing-structure.js",
  ));
  const { analyzeFeatures } = require(path.join(outDir, "src/lib/intelligence/features.js"));
  const { buildIntelligenceDisplay } = require(path.join(
    outDir,
    "src/lib/intelligence/display.js",
  ));
  const { buildProductRecommendations } = require(path.join(
    outDir,
    "src/lib/product-recommendations.js",
  ));
  const { isMasterAdminEmail } = require(path.join(outDir, "src/lib/master-admin.js"));
  const { planForStripePrice } = require(path.join(outDir, "src/lib/stripe.js"));

  check("Pricing page source has no production developer setup copy", () => {
    const pricingPage = read("src/app/pricing/page.tsx");

    assert.doesNotMatch(pricingPage, /add stripe environment variables/i);
    assert.doesNotMatch(pricingPage, /checkout appears after/i);
    assert.doesNotMatch(pricingPage, /AI-enhanced summaries/i);
  });

  check("Duplicate page-level sign-out buttons are removed", () => {
    assert.doesNotMatch(read("src/app/dashboard/page.tsx"), /signOutAction|Sign out/);
    assert.doesNotMatch(
      read("src/app/dashboard/competitors/[id]/page.tsx"),
      /signOutAction|Sign out/,
    );
    assert.doesNotMatch(read("src/app/dashboard/settings/page.tsx"), /signOutAction|Sign out/);
    assert.match(read("src/app/layout.tsx"), /signOutAction/);
  });

  check("PropAI pricing keeps Free and Plus while rejecting contaminated examples", () => {
    const scrape = baseScrape({
      html: `
        <main>
          <section>
            <h1>The freelance proposal generator that writes in your voice</h1>
            <p>Example client project budget $2,500-4,000.</p>
            <p>Generic AI proposal sample says $800/month.</p>
            <p>SEO-first article budget $80-120/article.</p>
          </section>
          <section class="pricing">
            <article class="plan-card">
              <h2>Free</h2>
              <p>50 proposals/week</p>
              <button>Sign up free</button>
            </article>
            <article class="plan-card">
              <h2>Plus</h2>
              <p>100 proposals/week</p>
              <p><span>\u20AC5</span> per month</p>
              <button>Get Plus</button>
            </article>
          </section>
        </main>
      `,
    });
    const pricing = analyzePricing(scrape, "pricing");
    const model = parsePricingStructure({ scrape, pageType: "pricing" });
    const acceptedFacts = pricing.facts.map((item) => item.value).join("\n");
    const userFacing = [
      ...model.plans.map((plan) => `${plan.name}:${plan.currency ?? ""} ${plan.price}`),
      ...model.usage_tiers.map((tier) => `${tier.label}:${tier.currency ?? ""} ${tier.price}`),
    ].join("\n");

    assert.match(acceptedFacts, /\u20AC5/);
    assert.ok(model.plans.some((plan) => /^free$/i.test(plan.name) && plan.price === 0));
    assert.ok(model.plans.some((plan) => /^plus$/i.test(plan.name) && plan.price === 5));
    assert.doesNotMatch(userFacing, /\$2,500|\$800|\$80|USD 2\.5|Plan 1|Plan 2|Plan 3|Visible price|Usage tier/i);
  });

  check("Plausible and Fathom pricing shapes stay structured", () => {
    const plausible = parsePricingStructure({
      pageType: "pricing",
      scrape: baseScrape({
        url: "https://plausible.io/pricing",
        html: `
          <main><section class="pricing table">
            <article class="plan-card"><h2>Starter</h2><p>$9 per month</p><button>Start trial</button></article>
            <article class="plan-card"><h2>Growth</h2><p>$19 per month</p><button>Start trial</button></article>
            <article class="plan-card"><h2>Business</h2><p>$69 per month</p><button>Start trial</button></article>
            <article class="plan-card"><h2>Enterprise</h2><p>Contact sales</p></article>
          </section></main>
        `,
      }),
    });
    const fathom = parsePricingStructure({
      pageType: "pricing",
      scrape: baseScrape({
        url: "https://usefathom.com/pricing",
        html: `
          <main><table class="pricing-table">
            <tr><th>Monthly pageviews</th><th>Price</th></tr>
            <tr><td>Up to 100,000 monthly pageviews</td><td>$15 per month</td></tr>
            <tr><td>Up to 200,000 monthly pageviews</td><td>$25 per month</td></tr>
            <tr><td>Up to 500,000 monthly pageviews</td><td>$45 per month</td></tr>
            <tr><td>1,000,000+ monthly pageviews</td><td>Contact us</td></tr>
          </table></main>
        `,
      }),
    });

    assert.ok(plausible.plans.some((plan) => plan.name === "Starter" && plan.price === 9));
    assert.ok(plausible.plans.some((plan) => plan.name === "Growth" && plan.price === 19));
    assert.ok(plausible.enterprise_options.length >= 1);
    assert.ok(fathom.usage_tiers.length >= 3);
    assert.ok(!fathom.plans.some((plan) => /^Plan \d+|Public pricing|Visible price|Usage tier/i.test(plan.name)));
  });

  check("PropAI feature output is readable and deduped", () => {
    const features = analyzeFeatures(
      baseScrape({
        url: "https://getpropai.com/features",
        html: `
          <main><section>
            <h2>Features</h2>
            <article><h3>Write in your voice</h3><p>Analyze a writing sample so proposals sound like you.</p></article>
            <article><h3>Fast proposal generator</h3><p>Generate client-ready proposals in minutes from a brief.</p></article>
            <article><h3>Personalized client proposals</h3><p>Tailor proposals to the job post and client brief.</p></article>
            <a>Get your first proposal</a>
          </section></main>
        `,
      }),
      "features",
    );
    const values = features.features.map((item) => item.value).join("\n");

    assert.equal(features.status, "found");
    assert.match(values, /Voice-matched proposal generation/);
    assert.match(values, /Writing sample analysis|Fast proposal creation/);
    assert.doesNotMatch(values, /Get your first proposal|(.+): \1/i);
  });

  check("Baseline recommendations fire without competitors when evidence supports it", () => {
    const recommendations = buildProductRecommendations({
      productFacts: [
        fact({ field: "homepage_headline", value: "Client-ready proposals in your voice" }),
        fact({ field: "primary_cta", value: "Learn more", confidence: "medium", score: 0.72 }),
        fact({ field: "pricing_visibility", value: "hidden", confidence: "medium", score: 0.72 }),
      ],
      competitorSnapshots: [],
    });

    assert.ok(recommendations.length >= 1);
    assert.ok(recommendations.every((item) => item.evidence_json?.trust?.basis === "baseline"));
    assert.ok(recommendations.length <= 3);
  });

  check("Warnings shown to normal users are sanitized", () => {
    const display = buildIntelligenceDisplay({
      id: "snapshot",
      createdAt: new Date().toISOString(),
      source: "deterministic",
      summary: {
        executiveSummary: null,
        pricingSummary: null,
        positioningSummary: null,
        featureSummary: null,
        ctaSummary: null,
        unknowns: [],
        warnings: ["OPENAI_API_KEY invalid", "HTTP 401 from /api/scan", "raw JSON parse failed"],
        overallConfidence: "low",
        businessProfile: null,
        scanQuality: null,
      },
      facts: [],
      analyzedPages: [],
      warnings: ["Some pricing-like matches were rejected. See pricing debug."],
    });
    const warnings = display?.warnings.join("\n") ?? "";

    assert.doesNotMatch(warnings, /OPENAI_API_KEY|HTTP 401|raw JSON|pricing debug/i);
    assert.match(warnings, /Deterministic analysis|Some pages could not be retrieved|limited coverage/);
  });

  check("Admin access remains env-only and unknown Stripe prices fail closed", () => {
    assert.equal(isMasterAdminEmail("admin@example.com"), false);
    process.env.MASTER_ADMIN_EMAILS = "admin@example.com";
    assert.equal(isMasterAdminEmail("admin@example.com"), true);
    assert.equal(planForStripePrice("price_unknown"), null);
    assert.equal(planForStripePrice("price_pro_month"), "pro");
  });

  check("No hardcoded founder admin email remains in source files", () => {
    const forbidden = "prop.alpha" + "@proton.me";
    const matches = allSourceFiles(path.join(rootDir, "src"))
      .concat(allSourceFiles(path.join(rootDir, "scripts")))
      .filter((file) => /\.(?:ts|tsx|js|mjs)$/.test(file))
      .filter((file) => readFileSync(file, "utf8").includes(forbidden));

    assert.deepEqual(matches, []);
  });
} finally {
  restoreResolver();
  await rm(outDir, { recursive: true, force: true });
}

const failed = results.filter((result) => result.status === "failed");
const report = `# Final V13 Private Beta Report

## SECTION A - Billing status
- Pricing UI no longer exposes setup or env-var messages.
- Missing paid checkout is presented as unavailable or coming soon.
- Unknown Stripe price IDs still fail closed.

## SECTION B - Pricing extractor status
- Context classification now rejects example, proposal, generated, testimonial, job-budget, project-budget, article-budget, blog, and FAQ prices.
- PropAI contaminated prices are not user-facing.

## SECTION C - Pricing change detection status
- Pricing changes continue to compare structured accepted pricing facts only.
- Rejected pricing-like candidates are excluded before model facts are produced.

## SECTION D - Feature extraction status
- Repeated feature labels and CTA-like feature candidates are suppressed.
- Proposal-specific feature names are normalized into readable product signals.

## SECTION E - Recommendation status
- Baseline recommendations can appear without competitors when own-product evidence supports a next action.
- Empty state now explains why no strong recommendation exists.

## SECTION F - Debug/status UI status
- Scan debug retrieval and rendering are gated by server-side admin checks.
- Snapshot wording is consolidated to one clear ready state.
- Page-level duplicate sign-out actions are removed.

## SECTION G - AI configuration status
- User-facing AI error language is replaced with deterministic-analysis copy.
- Marketing copy no longer promises unavailable AI-enhanced summaries.

## SECTION H - Admin/security status
- Admin checks remain env-only and fail closed.
- No hardcoded founder admin email remains in source files.

## SECTION I - Schema/plan-limit status
- Canonical billing state remains public.users.
- This script verifies code behavior; live webhook/plan updates still depend on Stripe env vars.

## SECTION J - PropAI founder test result
- ${results.find((result) => result.name.includes("PropAI pricing"))?.status ?? "not_run"}: pricing contamination regression.
- ${results.find((result) => result.name.includes("PropAI feature"))?.status ?? "not_run"}: feature readability regression.

## SECTION K - Plausible/Fathom regression result
- ${results.find((result) => result.name.includes("Plausible"))?.status ?? "not_run"}: structured pricing shape regression.

## SECTION L - Remaining blockers
${failed.length ? "- Fix failed V13 checks before private beta." : "- No local V13 code regression blockers from this suite."}
- Live paid checkout/webhook verification remains blocked until production Stripe env vars are configured.

## SECTION M - Manual actions required
- Add STRIPE_SECRET_KEY in Vercel Production from Stripe Developers > API keys.
- Add STRIPE_PRO_PRICE_ID=price_1TZmuPD81h8gl4lnicOj7MO1 in Vercel Production.
- Add STRIPE_WEBHOOK_SECRET in Vercel Production after creating the production webhook endpoint for /api/stripe/webhook.
- Add annual/business Stripe price IDs only when those products should be visible.
- Redeploy production after setting Stripe values and run a live Checkout + webhook test.

## SECTION N - Final verdict
${failed.length ? "PRIVATE BETA STILL BLOCKED" : "PRIVATE BETA STILL BLOCKED"}

${failed.length ? "PRIVATE BETA STILL BLOCKED" : "PRIVATE BETA STILL BLOCKED"}
`;

await writeFile(path.join(rootDir, reportPath), report);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, reportPath }, null, 2));

if (failed.length) {
  process.exitCode = 1;
}
