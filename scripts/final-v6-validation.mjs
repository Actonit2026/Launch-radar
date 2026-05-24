import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const outDir = await mkdtemp(path.join(tmpdir(), "launchradar-v6-"));

delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_SUMMARY_MODEL;
process.env.ENABLE_AI_SUMMARIES = "false";
process.env.LAUNCHRADAR_BROWSER_FALLBACK = "0";

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
  "src/lib/intelligence/positioning.ts",
  "src/lib/intelligence/ctas.ts",
  "src/lib/intelligence/features.ts",
  "src/lib/intelligence/changelog.ts",
  "src/lib/intelligence/models.ts",
  "src/lib/intelligence/analyze.ts",
  "src/lib/intelligence/business-profile.ts",
  "src/lib/product-recommendations.ts",
  "src/lib/change-detection.ts",
  "src/lib/validation/validation-saas-examples.ts",
  "src/lib/validation/suite.ts",
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

async function read(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

async function assertStaticUiContracts() {
  const [dashboard, changeCard, adminValidation, homepage, adminDemo] =
    await Promise.all([
      read("src/app/dashboard/page.tsx"),
      read("src/components/change-card.tsx"),
      read("src/app/admin/validation/page.tsx"),
      read("src/app/page.tsx"),
      read("src/app/admin/demo-examples/page.tsx"),
    ]);

  assert.match(dashboard, /MarketPulse/, "dashboard must include Market Pulse");
  assert.match(
    dashboard,
    /Review your baseline snapshot/,
    "dashboard must expose one baseline next action",
  );
  assert.match(changeCard, /Old/, "change card must label old values");
  assert.match(changeCard, /New/, "change card must label new values");
  assert.match(
    changeCard,
    /Why it matters/,
    "change card must explain why a change matters",
  );
  assert.match(
    adminValidation,
    /Run 10-SaaS suite/,
    "admin validation must run the 10-SaaS suite",
  );
  assert.match(
    adminValidation,
    /Run follow-up scan/,
    "admin validation must expose follow-up validation",
  );
  assert.match(
    adminValidation,
    /isMasterAdminEmail/,
    "admin validation must be master-admin gated",
  );
  assert.match(homepage, /Cached public-page examples/);
  assert.match(homepage, /last_verified_at/);
  assert.match(adminDemo, /Refresh one/);
}

function assertChangePayloadContracts(createDetectedChangePayload) {
  const payload = createDetectedChangePayload([
    {
      category: "pricing",
      changeType: "lowest_price_changed",
      summary: "Entry pricing changed from EUR 5/month to EUR 9/month.",
      severity: "high",
      confidenceScore: 0.92,
      whyItMatters:
        "Entry pricing increased, which may signal stronger monetization.",
      oldValue: "EUR 5/month",
      newValue: "EUR 9/month",
      evidence: [
        {
          source_url: "https://example.com/pricing",
          evidence_text: "Starter EUR 9 per month",
        },
      ],
    },
    {
      category: "pricing",
      changeType: "pro_price_changed",
      summary: "Pro pricing changed from EUR 19/month to EUR 29/month.",
      severity: "medium",
      confidenceScore: 0.9,
      whyItMatters:
        "The higher tier moved upward, affecting packaging comparison.",
      oldValue: "EUR 19/month",
      newValue: "EUR 29/month",
      evidence: [
        {
          source_url: "https://example.com/pricing",
          evidence_text: "Pro EUR 29 per month",
        },
      ],
    },
  ]);

  assert.ok(payload, "old/new changes must produce one grouped payload");
  assert.equal(payload.old_value, "EUR 5/month");
  assert.equal(payload.new_value, "EUR 9/month");
  assert.match(payload.diff_summary, /Pricing changed with 2 verified updates/);
  assert.equal(payload.change_type, "lowest_price_changed");
  assert.ok(
    Array.isArray(payload.evidence_json?.changes),
    "grouped payload must retain individual change details",
  );

  const noisyPayload = createDetectedChangePayload([
    {
      category: "content",
      changeType: "content_changed",
      summary: "Content changed.",
      severity: "low",
      confidenceScore: 0.5,
      whyItMatters: "This is too vague for a user-facing card.",
      evidence: [
        {
          source_url: "https://example.com",
          evidence_text: "Page content changed",
        },
      ],
    },
  ]);

  assert.equal(
    noisyPayload,
    null,
    "changes without old/new values must not create user-facing cards",
  );
}

function assertValidationCaseContracts(report) {
  assert.equal(report.ai_enabled, false, "validation must run with AI disabled");
  assert.ok(report.cases.length >= 10, "validation suite must include 10 cases");
  assert.ok(
    report.pass_count >= 8,
    `expected at least 8/10 SaaS cases to pass, got ${report.pass_count}/${report.cases.length}: ${JSON.stringify(
      report.cases.map((item) => ({
        product_name: item.product_name,
        analyzer_status: item.analyzer_status,
        facts_detected: item.facts_detected,
        failures: item.failures,
        warnings: item.warnings.slice(0, 3),
      })),
    )}`,
  );

  for (const item of report.cases) {
    assert.ok(item.product_name, "case must include product name");
    assert.ok(item.url, `${item.product_name}: missing URL`);
    assert.ok(
      item.baseline_hashes || item.failures.length,
      `${item.product_name}: missing baseline hashes or failure reason`,
    );
    assert.notEqual(
      item.day_one_baseline_status,
      "failed",
      `${item.product_name}: day-one baseline failed`,
    );
    assert.ok(
      item.watchlist_suggestions.length || item.failures.length,
      `${item.product_name}: missing watchlist suggestions or failure reason`,
    );
  }
}

try {
  compileSources();
  const restoreResolver = installAliasResolver();
  const originalFetch = globalThis.fetch;
  let openAiCalls = 0;

  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string" ? input : input?.url ? String(input.url) : "";

    if (/openai\.com/i.test(url)) {
      openAiCalls += 1;
      throw new Error("OpenAI calls are forbidden during V6 validation.");
    }

    return originalFetch(input, init);
  };

  const {
    runFollowUpValidationSuite,
    runScenarioValidation,
    runValidationSuite,
  } = require(path.join(outDir, "src/lib/validation/suite.js"));
  const { validationSaasExamples } = require(path.join(
    outDir,
    "src/lib/validation/validation-saas-examples.js",
  ));
  const { createDetectedChangePayload } = require(path.join(
    outDir,
    "src/lib/change-detection.js",
  ));

  assert.ok(
    validationSaasExamples.length >= 10,
    "validationSaasExamples must contain at least 10 cases",
  );
  assertChangePayloadContracts(createDetectedChangePayload);
  await assertStaticUiContracts();

  const suiteReport = await runValidationSuite();
  assertValidationCaseContracts(suiteReport);

  const scenarioInput = validationSaasExamples[0];
  const scenarioReport = await runScenarioValidation({
    productUrl: scenarioInput.url,
    competitorUrls: scenarioInput.competitor_urls.slice(0, 2),
  });
  assert.equal(scenarioReport.ai_enabled, false);
  assert.equal(scenarioReport.cases.length, 1);
  assert.equal(scenarioReport.cases[0].competitor_count, 2);
  assert.notEqual(scenarioReport.cases[0].day_one_baseline_status, "failed");

  const followUpReport = await runFollowUpValidationSuite(suiteReport, {
    names: [scenarioInput.name],
  });
  assert.equal(followUpReport.run_type, "follow_up");
  assert.ok(followUpReport.cases[0].follow_up_comparison);
  assert.equal(openAiCalls, 0, "deterministic validation must not call OpenAI");

  restoreResolver();
  globalThis.fetch = originalFetch;

  console.log(
    JSON.stringify(
      {
        ok: true,
        ai_enabled: false,
        openai_calls: openAiCalls,
        live_suite: {
          pass_count: suiteReport.pass_count,
          fail_count: suiteReport.fail_count,
          case_count: suiteReport.cases.length,
          ship_ready: suiteReport.ship_ready,
          cases: suiteReport.cases.map((item) => ({
            product_name: item.product_name,
            analyzer_status: item.analyzer_status,
            pricing_status: item.pricing_status,
            positioning_status: item.positioning_status,
            cta_status: item.cta_status,
            feature_status: item.feature_status,
            competitor_count: item.competitor_count,
            day_one_baseline_status: item.day_one_baseline_status,
            facts_detected: item.facts_detected,
            failures: item.failures,
            warnings: item.warnings.slice(0, 3),
            ship_ready_for_this_case: item.ship_ready_for_this_case,
          })),
        },
        scenario: scenarioReport.cases[0],
        follow_up: followUpReport.cases[0].follow_up_comparison,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(outDir, { recursive: true, force: true });
}
