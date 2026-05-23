import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const outDir = await mkdtemp(path.join(tmpdir(), "launchradar-v4-real-"));

delete process.env.OPENAI_API_KEY;
process.env.ENABLE_AI_SUMMARIES = "false";

const sourceFiles = [
  "src/lib/database.types.ts",
  "src/lib/urls.ts",
  "src/lib/crawler/text.ts",
  "src/lib/crawler/robots.ts",
  "src/lib/crawler/browser.ts",
  "src/lib/crawler/scraper.ts",
  "src/lib/crawler/discovery.ts",
  "src/lib/intelligence/types.ts",
  "src/lib/intelligence/text.ts",
  "src/lib/intelligence/pricing.ts",
  "src/lib/intelligence/positioning.ts",
  "src/lib/intelligence/ctas.ts",
  "src/lib/intelligence/features.ts",
  "src/lib/intelligence/changelog.ts",
  "src/lib/intelligence/analyze.ts",
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

function bestPrice(pages) {
  return pages
    .flatMap((page) => page.pricing.paidPlans)
    .sort(
      (a, b) =>
        (a.normalized_value?.amount ?? Number.POSITIVE_INFINITY) -
        (b.normalized_value?.amount ?? Number.POSITIVE_INFINITY),
    )[0];
}

function bestFact(pages, fields) {
  return pages
    .flatMap((page) => page.facts.filter((fact) => fields.includes(fact.field)))
    .sort((a, b) => b.confidence_score - a.confidence_score)[0];
}

const targets = [
  {
    name: "LaunchRadar",
    url: "https://launch-radar-smoky.vercel.app",
    expectAnyPrice: true,
  },
  { name: "Linear", url: "https://linear.app" },
  { name: "Supabase", url: "https://supabase.com" },
  { name: "Resend", url: "https://resend.com" },
  {
    name: "Plausible",
    url: "https://plausible.io/docs/subscription-plans",
  },
  { name: "Carrd", url: "https://carrd.co", expectAnyPrice: true },
  { name: "Fathom", url: "https://usefathom.com", expectAnyPrice: true },
];

const results = [];

try {
  compileSources();
  const restoreResolver = installAliasResolver();
  const { discoverCompetitorPages } = require(path.join(
    outDir,
    "src/lib/crawler/discovery.js",
  ));
  const { parseCompetitorUrl } = require(path.join(
    outDir,
    "src/lib/urls.js",
  ));
  const { analyzePageIntelligence } = require(path.join(
    outDir,
    "src/lib/intelligence/analyze.js",
  ));

  for (const target of targets) {
    const parsed = parseCompetitorUrl(target.url);
    const discovered = await discoverCompetitorPages(parsed.baseUrl, {
      submittedPageUrl: parsed.submittedPageUrl,
    });
    const pages = discovered
      .filter((page) => page.scrape.rawText && page.scrape.ok)
      .slice(0, 5)
      .map((page) =>
        analyzePageIntelligence({
          pageType: page.pageType,
          scrape: page.scrape,
        }),
      );
    const price = bestPrice(pages);
    const positioning = bestFact(pages, [
      "homepage_headline",
      "main_value_prop",
      "subheadline",
    ]);
    const cta = bestFact(pages, ["primary_cta", "secondary_cta"]);
    const features = pages.flatMap((page) => page.features.features).slice(0, 5);
    const warnings = pages.flatMap((page) => page.warnings);

    assert.ok(pages.length, `${target.name}: no analyzable pages`);
    assert.ok(positioning, `${target.name}: positioning missing`);
    assert.ok(cta, `${target.name}: CTA missing`);

    if (target.expectAnyPrice) {
      assert.ok(price, `${target.name}: expected visible price was missed`);
    }

    assert.doesNotMatch(
      [positioning?.value, cta?.value, ...warnings].join(" "),
      /raw 429|quota exceeded|stack trace|openai api/i,
      `${target.name}: raw service error leaked`,
    );

    results.push({
      name: target.name,
      pricing: price
        ? {
            value: price.value,
            normalized: price.normalized_value,
            confidence: price.confidence,
            source_url: price.source_url,
          }
        : { status: "not_detected" },
      positioning: {
        value: positioning.value,
        confidence: positioning.confidence,
        source_url: positioning.source_url,
      },
      cta: {
        value: cta.value,
        confidence: cta.confidence,
        source_url: cta.source_url,
      },
      features: features.map((feature) => ({
        value: feature.value,
        confidence: feature.confidence,
        source_url: feature.source_url,
      })),
      warnings: Array.from(new Set(warnings)).slice(0, 5),
    });
  }

  restoreResolver();
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  await rm(outDir, { recursive: true, force: true });
}
