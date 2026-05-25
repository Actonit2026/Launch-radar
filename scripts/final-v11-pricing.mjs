import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const outDir = await mkdtemp(path.join(tmpdir(), "launchradar-v11-"));
const outputPath = "docs/final-v11-pricing-output.json";
const reportPath = "docs/final-v11-pricing-report.md";

process.env.ENABLE_AI_SUMMARIES = "false";
process.env.LAUNCHRADAR_BROWSER_FALLBACK =
  process.env.LAUNCHRADAR_BROWSER_FALLBACK ?? "0";
process.env.MAX_PAGES_PER_SCAN = process.env.MAX_PAGES_PER_SCAN ?? "8";

const sourceFiles = [
  "src/lib/database.types.ts",
  "src/lib/urls.ts",
  "src/lib/supabase/config.ts",
  "src/lib/supabase/admin.ts",
  "src/lib/crawler/text.ts",
  "src/lib/crawler/robots.ts",
  "src/lib/crawler/browser.ts",
  "src/lib/crawler/scraper.ts",
  "src/lib/crawler/discovery.ts",
  "src/lib/intelligence/types.ts",
  "src/lib/intelligence/text.ts",
  "src/lib/intelligence/pricing.ts",
  "src/lib/intelligence/pricing-structure.ts",
  "src/lib/intelligence/positioning.ts",
  "src/lib/intelligence/ctas.ts",
  "src/lib/intelligence/features.ts",
  "src/lib/intelligence/changelog.ts",
  "src/lib/intelligence/models.ts",
  "src/lib/intelligence/analyze.ts",
  "src/lib/intelligence/business-profile.ts",
  "src/lib/scan-quality.ts",
  "src/lib/product-recommendations.ts",
  "src/lib/change-detection.ts",
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

const validationSites = [
  ["Plausible", "https://plausible.io"],
  ["Fathom", "https://usefathom.com"],
  ["Simple Analytics", "https://www.simpleanalytics.com"],
  ["PostHog", "https://posthog.com"],
  ["Pirsch", "https://pirsch.io"],
  ["June", "https://www.june.so"],
  ["Sentry", "https://sentry.io"],
  ["Better Stack", "https://betterstack.com"],
  ["UptimeRobot", "https://uptimerobot.com"],
  ["Checkly", "https://www.checklyhq.com"],
  ["Cronitor", "https://cronitor.io"],
  ["Framer", "https://www.framer.com"],
  ["Webflow", "https://webflow.com"],
  ["Carrd", "https://carrd.co"],
  ["Bubble", "https://bubble.io"],
  ["Supabase", "https://supabase.com"],
  ["Vercel", "https://vercel.com"],
  ["Linear", "https://linear.app"],
  ["Clerk", "https://clerk.com"],
  ["Paddle", "https://www.paddle.com"],
].map(([name, url]) => ({ name, url }));

const plausibleExpected = [
  ["Starter", 9, "EUR"],
  ["Growth", 14, "EUR"],
  ["Business", 19, "EUR"],
];
const fathomExpectedTiers = [
  [15, "100,000"],
  [25, "200,000"],
  [45, "500,000"],
  [60, "1,000,000"],
  [100, "2,000,000"],
  [140, "5,000,000"],
  [200, "10,000,000"],
  [290, "15,000,000"],
  [380, "20,000,000"],
  [470, "25,000,000"],
];

function modelFromPages(pages) {
  const pricingPages = pages
    .map((page) => page.models.pricing)
    .filter((model) =>
      model.plans.length ||
      model.usage_tiers.length ||
      model.enterprise_options.length ||
      model.pricing_visibility !== "unknown",
    )
    .sort(
      (a, b) =>
        b.completeness_score - a.completeness_score ||
        b.plans.length + b.usage_tiers.length - (a.plans.length + a.usage_tiers.length),
    );

  return pricingPages[0] ?? null;
}

function normalizePlanName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function containsExpectedPlan(model, [name, price, currency]) {
  const expectedName = normalizePlanName(name);

  return model?.plans.some((plan) =>
    normalizePlanName(plan.name).includes(expectedName) &&
    plan.price === price &&
    plan.currency === currency,
  );
}

function containsExpectedTier(model, [price, limit]) {
  return model?.usage_tiers.some((tier) =>
    tier.price === price && new RegExp(limit.replace(/,/g, ",?")).test(tier.limit ?? ""),
  );
}

function siteSummary({ site, discovered, pages, model, durationMs, error }) {
  return {
    name: site.name,
    url: site.url,
    duration_ms: durationMs,
    pages_discovered: discovered.length,
    pages_analyzed: pages.length,
    pricing_visibility: model?.pricing_visibility ?? "unknown",
    pricing_model_type: model?.pricing_model_type ?? "unknown",
    completeness_score: model?.completeness_score ?? 0,
    billing_modes: model?.billing_modes ?? [],
    plans: model?.plans.map((plan) => ({
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      billing_period: plan.billing_period,
      billing_mode: plan.billing_mode,
      billing_type: plan.billing_type,
      limits: plan.limits,
      is_custom_price: plan.is_custom_price,
    })) ?? [],
    usage_tiers: model?.usage_tiers.map((tier) => ({
      label: tier.label,
      price: tier.price,
      currency: tier.currency,
      billing_period: tier.billing_period,
      limit: tier.limit,
    })) ?? [],
    enterprise_options: model?.enterprise_options.map((option) => ({
      name: option.name,
      cta: option.cta,
    })) ?? [],
    missing_possible_data: model?.missing_possible_data ?? [],
    error: error?.message ?? null,
  };
}

async function mapLimit(items, limit, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await callback(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

function pct(value, total) {
  return total ? Math.round((value / total) * 100) : 100;
}

try {
  compileSources();
  const restoreResolver = installAliasResolver();
  const { discoverCompetitorPages } = require(path.join(
    outDir,
    "src/lib/crawler/discovery.js",
  ));
  const { analyzePagesIntelligence } = require(path.join(
    outDir,
    "src/lib/intelligence/analyze.js",
  ));

  const results = await mapLimit(validationSites, 3, async (site) => {
    const start = Date.now();

    try {
      const discovered = await discoverCompetitorPages(site.url);
      const pages = analyzePagesIntelligence(
        discovered
          .filter((page) => page.scrape.ok)
          .map((page) => ({ pageType: page.pageType, scrape: page.scrape })),
      );
      const model = modelFromPages(pages);

      return siteSummary({
        site,
        discovered,
        pages,
        model,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      return siteSummary({
        site,
        discovered: [],
        pages: [],
        model: null,
        durationMs: Date.now() - start,
        error,
      });
    }
  });

  const plausible = results.find((item) => item.name === "Plausible");
  const fathom = results.find((item) => item.name === "Fathom");
  const plausibleResult = {
    expected: plausibleExpected.map(([name, price, currency]) => ({
      name,
      price,
      currency,
      billing_period: "month",
    })),
    actual_plans: plausible?.plans ?? [],
    matched: plausibleExpected.map((expected) => ({
      expected,
      found: containsExpectedPlan(plausible, expected),
    })),
    enterprise_found: Boolean(
      plausible?.plans.some((plan) => plan.is_custom_price) ||
      plausible?.enterprise_options.length,
    ),
    monthly_yearly_found:
      plausible?.billing_modes.includes("monthly") &&
      plausible?.billing_modes.includes("yearly"),
    pageview_model_found:
      plausible?.billing_modes.includes("usage") ||
      plausible?.pricing_model_type.includes("usage") ||
      plausible?.plans.some((plan) => /pageviews?/i.test(plan.limits.join(" "))),
    completeness_score: plausible?.completeness_score ?? 0,
  };
  const fathomResult = {
    expected_tiers: fathomExpectedTiers.map(([price, limit]) => ({
      price,
      currency: "USD",
      limit: `up to ${limit} pageviews`,
    })),
    actual_tiers: fathom?.usage_tiers ?? [],
    matched: fathomExpectedTiers.map((expected) => ({
      expected,
      found: containsExpectedTier(fathom, expected),
    })),
    contact_overage_found: Boolean(
      fathom?.usage_tiers.some((tier) =>
        tier.price === null && /25,000,000/i.test(tier.limit ?? ""),
      ) ||
      fathom?.enterprise_options.length,
    ),
    monthly_yearly_found:
      fathom?.billing_modes.includes("monthly") &&
      fathom?.billing_modes.includes("yearly"),
    completeness_score: fathom?.completeness_score ?? 0,
  };
  const validation = {
    sites: results.length,
    public_or_contact_pricing: pct(
      results.filter((item) =>
        ["public", "partially_public", "contact_sales"].includes(
          item.pricing_visibility,
        ),
      ).length,
      results.length,
    ),
    structured_pricing: pct(
      results.filter((item) => item.plans.length || item.usage_tiers.length).length,
      results.length,
    ),
    complete_or_main_structure: pct(
      results.filter((item) => item.completeness_score >= 60).length,
      results.length,
    ),
    no_low_confidence_price_only: pct(
      results.filter((item) => item.completeness_score !== 40).length,
      results.length,
    ),
  };
  const plausibleOk =
    plausibleResult.matched.every((item) => item.found) &&
    plausibleResult.enterprise_found &&
    plausibleResult.monthly_yearly_found &&
    plausibleResult.pageview_model_found &&
    plausibleResult.completeness_score >= 80;
  const fathomOk =
    fathomResult.matched.every((item) => item.found) &&
    fathomResult.contact_overage_found &&
    fathomResult.monthly_yearly_found &&
    fathomResult.completeness_score >= 80;
  const fixed =
    plausibleOk &&
    fathomOk &&
    validation.structured_pricing >= 70 &&
    validation.complete_or_main_structure >= 60;
  const finalLine = fixed ? "PRICING ENGINE FIXED" : "PRICING ENGINE STILL BROKEN";
  const output = {
    plausible: plausibleResult,
    fathom: fathomResult,
    validation,
    results,
    fixed,
    final_line: finalLine,
  };
  const markdown = [
    "# Final V11 Pricing Engine Report",
    "",
    "SECTION A - Root cause",
    "- The old pricing path optimized for isolated visible price regex matches, so it collapsed pricing pages to one amount and missed structures hidden in tables, cards, modals, toggles, and usage tiers.",
    "- This made Plausible/Fathom-style pricing look artificially incomplete even when public evidence existed.",
    "",
    "SECTION B - Parser changes",
    "- Added structured pricing parsing for cards, tables, static hidden/modal DOM, usage tiers, billing toggles, sliders/calculators, custom enterprise options, evidence, completeness, and missing-data flags.",
    "- Pricing model facts now include pricing_plan, usage_tier, billing_mode, pricing_model_type, pricing_completeness, and pricing_missing_data.",
    "",
    "SECTION C - Plausible result vs expected",
    `- Matched plans: ${plausibleResult.matched.filter((item) => item.found).length}/${plausibleResult.matched.length}.`,
    `- Enterprise/custom: ${plausibleResult.enterprise_found ? "found" : "missing"}.`,
    `- Monthly/yearly toggle: ${plausibleResult.monthly_yearly_found ? "found" : "missing"}.`,
    `- Pageview model: ${plausibleResult.pageview_model_found ? "found" : "missing"}.`,
    `- Completeness: ${plausibleResult.completeness_score}/100.`,
    "",
    "SECTION D - Fathom result vs expected",
    `- Matched usage tiers: ${fathomResult.matched.filter((item) => item.found).length}/${fathomResult.matched.length}.`,
    `- Contact overage: ${fathomResult.contact_overage_found ? "found" : "missing"}.`,
    `- Monthly/yearly toggle: ${fathomResult.monthly_yearly_found ? "found" : "missing"}.`,
    `- Completeness: ${fathomResult.completeness_score}/100.`,
    "",
    "SECTION E - 20-page validation",
    `- Public/contact pricing detected: ${validation.public_or_contact_pricing}/100.`,
    `- Structured plans or usage tiers detected: ${validation.structured_pricing}/100.`,
    `- Complete or main structure parsed: ${validation.complete_or_main_structure}/100.`,
    `- No interaction-only low-confidence output: ${validation.no_low_confidence_price_only}/100.`,
    "",
    "SECTION F - Limitations",
    "- Sites that render pricing entirely after client-side interaction may still require browser rendering or manual page override.",
    "- Yearly toggle detection is recorded separately when the static DOM exposes monthly prices but not yearly prices.",
    "",
    finalLine,
  ].join("\n");

  await writeFile(path.resolve(rootDir, outputPath), JSON.stringify(output, null, 2), "utf8");
  await writeFile(path.resolve(rootDir, reportPath), markdown, "utf8");

  console.log(markdown);
  restoreResolver();
} finally {
  await rm(outDir, { recursive: true, force: true });
}
