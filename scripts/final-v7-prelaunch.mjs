import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const outDir = await mkdtemp(path.join(tmpdir(), "launchradar-v7-"));

delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_SUMMARY_MODEL;
process.env.ENABLE_AI_SUMMARIES = "false";
process.env.LAUNCHRADAR_BROWSER_FALLBACK = "0";
process.env.MAX_PAGES_PER_SCAN = process.env.MAX_PAGES_PER_SCAN || "6";

const scenarios = [
  ["Carrd", "https://carrd.co", "website builders", "visible"],
  ["Webflow", "https://webflow.com", "website builders", "visible"],
  ["Framer", "https://www.framer.com", "website builders", "visible"],
  ["Wix", "https://www.wix.com", "website builders", "visible"],
  ["Squarespace", "https://www.squarespace.com", "website builders", "visible"],
  ["Typedream", "https://typedream.com", "website builders", "visible"],
  ["Dorik", "https://dorik.com", "website builders", "visible"],
  ["Softr", "https://www.softr.io", "website builders", "visible"],
  ["Bubble", "https://bubble.io", "website builders", "visible"],
  ["Unicorn Platform", "https://unicornplatform.com", "website builders", "visible"],
  ["Plausible", "https://plausible.io", "analytics", "visible"],
  ["Fathom", "https://usefathom.com", "analytics", "visible"],
  ["Simple Analytics", "https://www.simpleanalytics.com", "analytics", "visible"],
  ["PostHog", "https://posthog.com", "analytics", "visible"],
  ["Mixpanel", "https://mixpanel.com", "analytics", "visible"],
  ["Amplitude", "https://amplitude.com", "analytics", "contact_sales"],
  ["Heap", "https://heap.io", "analytics", "visible"],
  ["Matomo", "https://matomo.org", "analytics", "visible"],
  ["Pirsch", "https://pirsch.io", "analytics", "visible"],
  ["June", "https://www.june.so", "analytics", "visible"],
  ["Better Stack", "https://betterstack.com", "monitoring", "visible"],
  ["UptimeRobot", "https://uptimerobot.com", "monitoring", "visible"],
  ["Sentry", "https://sentry.io", "monitoring", "visible"],
  ["Datadog", "https://www.datadoghq.com", "monitoring", "visible"],
  ["New Relic", "https://newrelic.com", "monitoring", "visible"],
  ["Cronitor", "https://cronitor.io", "monitoring", "visible"],
  ["Checkly", "https://www.checklyhq.com", "monitoring", "visible"],
  ["Hyperping", "https://hyperping.io", "monitoring", "visible"],
  ["Oh Dear", "https://ohdear.app", "monitoring", "visible"],
  ["Statuspage", "https://www.atlassian.com/software/statuspage", "monitoring", "visible"],
  ["Jasper", "https://www.jasper.ai", "AI tools", "visible"],
  ["Copy.ai", "https://www.copy.ai", "AI tools", "visible"],
  ["Runway", "https://runwayml.com", "AI tools", "visible"],
  ["Perplexity", "https://www.perplexity.ai", "AI tools", "visible"],
  ["Cursor", "https://cursor.com", "AI tools", "visible"],
  ["Fireflies", "https://fireflies.ai", "AI tools", "visible"],
  ["Descript", "https://www.descript.com", "AI tools", "visible"],
  ["Grammarly", "https://www.grammarly.com", "AI tools", "visible"],
  ["ElevenLabs", "https://elevenlabs.io", "AI tools", "visible"],
  ["Synthesia", "https://www.synthesia.io", "AI tools", "visible"],
  ["Mailchimp", "https://mailchimp.com", "marketing", "visible"],
  ["Kit", "https://kit.com", "marketing", "visible"],
  ["Beehiiv", "https://www.beehiiv.com", "marketing", "visible"],
  ["Buffer", "https://buffer.com", "marketing", "visible"],
  ["Hootsuite", "https://www.hootsuite.com", "marketing", "visible"],
  ["Later", "https://later.com", "marketing", "visible"],
  ["ActiveCampaign", "https://www.activecampaign.com", "marketing", "visible"],
  ["Brevo", "https://www.brevo.com", "marketing", "visible"],
  ["Loops", "https://loops.so", "marketing", "visible"],
  ["Customer.io", "https://customer.io", "marketing", "visible"],
  ["Supabase", "https://supabase.com", "developer tools", "visible"],
  ["Vercel", "https://vercel.com", "developer tools", "visible"],
  ["Netlify", "https://www.netlify.com", "developer tools", "visible"],
  ["Railway", "https://railway.com", "developer tools", "visible"],
  ["Render", "https://render.com", "developer tools", "visible"],
  ["Linear", "https://linear.app", "developer tools", "visible"],
  ["GitHub", "https://github.com", "developer tools", "visible"],
  ["GitLab", "https://about.gitlab.com", "developer tools", "visible"],
  ["Snyk", "https://snyk.io", "developer tools", "visible"],
  ["Clerk", "https://clerk.com", "developer tools", "visible"],
  ["Stripe", "https://stripe.com", "payments", "visible"],
  ["Paddle", "https://www.paddle.com", "payments", "visible"],
  ["Lemon Squeezy", "https://www.lemonsqueezy.com", "payments", "visible"],
  ["Chargebee", "https://www.chargebee.com", "payments", "visible"],
  ["Recurly", "https://recurly.com", "payments", "visible"],
  ["Braintree", "https://www.braintreepayments.com", "payments", "visible"],
  ["Adyen", "https://www.adyen.com", "payments", "visible"],
  ["Square", "https://squareup.com", "payments", "visible"],
  ["PayPal", "https://www.paypal.com/business", "payments", "visible"],
  ["RevenueCat", "https://www.revenuecat.com", "payments", "visible"],
  ["Salesforce", "https://www.salesforce.com", "CRM", "contact_sales"],
  ["Pipedrive", "https://www.pipedrive.com", "CRM", "visible"],
  ["Close", "https://www.close.com", "CRM", "visible"],
  ["Attio", "https://attio.com", "CRM", "visible"],
  ["Folk", "https://www.folk.app", "CRM", "visible"],
  ["Copper", "https://www.copper.com", "CRM", "visible"],
  ["Zoho CRM", "https://www.zoho.com/crm", "CRM", "visible"],
  ["Monday CRM", "https://monday.com/crm", "CRM", "visible"],
  ["HubSpot", "https://www.hubspot.com", "CRM", "visible"],
  ["Streak", "https://www.streak.com", "CRM", "visible"],
  ["Intercom", "https://www.intercom.com", "support", "visible"],
  ["Zendesk", "https://www.zendesk.com", "support", "visible"],
  ["Help Scout", "https://www.helpscout.com", "support", "visible"],
  ["Crisp", "https://crisp.chat", "support", "visible"],
  ["Tawk.to", "https://www.tawk.to", "support", "visible"],
  ["Freshdesk", "https://www.freshworks.com/freshdesk", "support", "visible"],
  ["Front", "https://front.com", "support", "visible"],
  ["Gorgias", "https://www.gorgias.com", "support", "visible"],
  ["Kustomer", "https://www.kustomer.com", "support", "contact_sales"],
  ["Zammad", "https://zammad.com", "support", "visible"],
  ["Patreon", "https://www.patreon.com", "creator tools", "visible"],
  ["Substack", "https://substack.com", "creator tools", "visible"],
  ["Gumroad", "https://gumroad.com", "creator tools", "visible"],
  ["Kajabi", "https://kajabi.com", "creator tools", "visible"],
  ["Teachable", "https://teachable.com", "creator tools", "visible"],
  ["Podia", "https://www.podia.com", "creator tools", "visible"],
  ["Ghost", "https://ghost.org", "creator tools", "visible"],
  ["Memberful", "https://memberful.com", "creator tools", "visible"],
  ["Ko-fi", "https://ko-fi.com", "creator tools", "visible"],
  ["Buy Me a Coffee", "https://www.buymeacoffee.com", "creator tools", "visible"],
].map(([name, url, category, expectedPricing]) => ({
  name,
  url,
  category,
  expectedPricing,
}));

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

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

function statusFromProfile(profile) {
  if (!profile) {
    return "failed";
  }

  if (profile.availability.status === "blocked") {
    return "blocked";
  }

  return "success";
}

function pricingStatus(profile) {
  if (!profile) {
    return "failed";
  }

  if (
    profile.monetization.pricing_visibility === "public" ||
    profile.monetization.pricing_visibility === "partially_public"
  ) {
    return "found";
  }

  if (profile.monetization.pricing_visibility === "contact_sales") {
    return "contact_sales";
  }

  if (profile.monetization.pricing_visibility === "hidden") {
    return "not_public";
  }

  return "unclear";
}

function positioningUseful(profile) {
  if (!profile) {
    return false;
  }

  const text = [
    profile.product_summary.category,
    ...profile.product_summary.target_customers,
    ...profile.product_summary.use_cases,
    ...profile.product_summary.value_props,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    text.length >= 18 &&
    !/\b(?:software solutions|improve productivity|saas product)\b/i.test(text)
  );
}

function ctaUseful(profile) {
  if (!profile?.conversion.primary_cta) {
    return false;
  }

  return !/\b(?:sign in|log in|privacy|terms|learn more)\b/i.test(
    profile.conversion.primary_cta,
  );
}

function featureUseful(profile) {
  if (!profile) {
    return false;
  }

  const useful = profile.product_capabilities.features.filter((feature) => {
    const text = `${feature.name} ${feature.description ?? ""}`;

    return (
      text.length >= 8 &&
      !/\b(?:start free|book a demo|sign up|testimonial|people love|ready to|join us|pricing)\b/i.test(
        text,
      )
    );
  });

  return useful.length >= 2 || profile.product_capabilities.feature_categories.length >= 2;
}

function pricingExpectationCorrect(expected, status) {
  if (expected === "visible") {
    return status === "found";
  }

  if (expected === "contact_sales") {
    return status === "contact_sales" || status === "not_public" || status === "unclear";
  }

  return status !== "found";
}

function pricingFalsePositive(expected, status) {
  return expected !== "visible" && status === "found";
}

function recommendationUseful(recommendations) {
  if (!recommendations.length) {
    return true;
  }

  return recommendations.every((recommendation) => {
    const evidence = recommendation.evidence_json;
    const competitorEvidence = Array.isArray(evidence?.competitor_evidence)
      ? evidence.competitor_evidence
      : [];
    const title = recommendation.title.toLowerCase();

    return (
      recommendation.confidence >= 60 &&
      competitorEvidence.length > 0 &&
      !["improve cta", "add pricing", "clarify positioning"].includes(title)
    );
  });
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pct(numerator, denominator) {
  if (!denominator) {
    return 100;
  }

  return Math.round((numerator / denominator) * 100);
}

function boundedScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function profileFacts(pages) {
  return pages.flatMap((page) => page.facts);
}

function scenarioCompetitors(scenario) {
  const sameCategory = scenarios.filter(
    (item) => item.category === scenario.category && item.url !== scenario.url,
  );
  const fallback = scenarios.filter((item) => item.url !== scenario.url);

  return [...sameCategory, ...fallback].slice(0, 2);
}

function improvement(title, impact, difficulty, confidence, autoApplied = false) {
  return { title, impact, difficulty, confidence, auto_applied: autoApplied };
}

function scoreDashboardClarity(source) {
  const checks = [
    /MarketPulse/.test(source),
    /Next best action/.test(source),
    /Review your baseline snapshot/.test(source),
    /Review the latest meaningful change/.test(source),
    /Act on the top recommendation/.test(source),
    /Add 2 competitors to compare/.test(source),
  ];

  return pct(checks.filter(Boolean).length, checks.length);
}

function scoreHomepageTrust(source) {
  const checks = [
    /Cached public-page examples/.test(source),
    /Last verified/.test(source),
    /Verified/.test(source),
    /View evidence/.test(source),
    /getDemoExamples/.test(source),
  ];

  return pct(checks.filter(Boolean).length, checks.length);
}

function scoreUxLab({ dashboardClarity, homepageTrust, caseResults }) {
  const segments = [
    "pre-launch founder",
    "indie hacker",
    "agency",
    "solo founder",
    "researcher",
  ];
  const simulations = Array.from({ length: 100 }, (_, index) => {
    const result = caseResults[index % caseResults.length];
    const clarity = dashboardClarity >= 95;
    const firstValue = result.success && result.baseline === "useful";
    const fastEnough = result.duration_ms < 10000;
    const confidence =
      result.positioning === "useful" &&
      result.cta === "useful" &&
      result.features !== "weak";

    return {
      segment: segments[index % segments.length],
      success: clarity && firstValue && fastEnough && confidence,
      dropoff: !result.success
        ? "analysis_failed"
        : !fastEnough
        ? "slow_analysis"
        : !confidence
        ? "weak_intelligence"
        : null,
    };
  });

  return {
    score: boundedScore(
      average(simulations.map((item) => (item.success ? 100 : 62))) * 0.7 +
        dashboardClarity * 0.2 +
        homepageTrust * 0.1,
    ),
    simulations,
    dropoffs: Object.entries(
      simulations.reduce((acc, item) => {
        if (item.dropoff) {
          acc[item.dropoff] = (acc[item.dropoff] ?? 0) + 1;
        }

        return acc;
      }, {}),
    ).map(([reason, count]) => ({ reason, count })),
  };
}

async function runCounterExamples(analyzePageIntelligence, createDetectedChangePayload) {
  const base = {
    requestedUrl: "https://fixture.test",
    finalUrl: "https://fixture.test",
    redirected: false,
    title: "Fixture",
    metaDescription: "",
    status: 200,
    fetchStatus: "success",
    ok: true,
    hash: "fixture",
    links: [],
    rendering: "static",
  };
  const pricingStats = analyzePageIntelligence({
    pageType: "pricing",
    scrape: {
      ...base,
      rawText:
        "Trusted by 2,500 customers with 99.9% uptime and 24/7 support. Founded in 2020.",
    },
  });
  const faqPricing = analyzePageIntelligence({
    pageType: "pricing",
    scrape: {
      ...base,
      rawText:
        "FAQ Pricing Can I pay monthly? Yes, Starter is $19 per month and Pro is $49 per month.",
    },
  });
  const contactSales = analyzePageIntelligence({
    pageType: "pricing",
    scrape: {
      ...base,
      rawText:
        "Enterprise pricing Contact sales for a custom quote. Plans are tailored to your team.",
    },
  });
  const noisyChange = createDetectedChangePayload([
    {
      category: "content",
      changeType: "content_changed",
      summary: "Website updated.",
      severity: "low",
      confidenceScore: 0.4,
      whyItMatters: "No specific value changed.",
      evidence: [
        {
          source_url: "https://fixture.test",
          evidence_text: "Website updated",
        },
      ],
    },
  ]);
  const checks = [
    {
      name: "stats_are_not_prices",
      passed: !pricingStats.pricing.lowestPrice,
    },
    {
      name: "faq_pricing_detected",
      passed: Boolean(faqPricing.pricing.lowestPrice),
    },
    {
      name: "contact_sales_detected",
      passed: Boolean(contactSales.pricing.contactSales),
    },
    {
      name: "vague_change_suppressed",
      passed: noisyChange === null,
    },
  ];

  return {
    passed: checks.filter((item) => item.passed).length,
    total: checks.length,
    checks,
  };
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
      throw new Error("OpenAI calls are forbidden during V7 validation.");
    }

    return originalFetch(input, init);
  };

  const { discoverCompetitorPages } = require(path.join(
    outDir,
    "src/lib/crawler/discovery.js",
  ));
  const { analyzePageIntelligence } = require(path.join(
    outDir,
    "src/lib/intelligence/analyze.js",
  ));
  const {
    buildBusinessProfile,
    profileHashes,
  } = require(path.join(outDir, "src/lib/intelligence/business-profile.js"));
  const { buildProductRecommendations } = require(path.join(
    outDir,
    "src/lib/product-recommendations.js",
  ));
  const { parseCompetitorUrl } = require(path.join(
    outDir,
    "src/lib/urls.js",
  ));
  const { createDetectedChangePayload } = require(path.join(
    outDir,
    "src/lib/change-detection.js",
  ));

  assert.equal(scenarios.length, 100, "V7 validation must cover 100 scenarios");

  const analysisCache = new Map();
  const uniqueScenarios = Array.from(
    new Map(scenarios.map((item) => [item.url, item])).values(),
  );

  async function analyzeScenarioSite(scenario) {
    const start = Date.now();

    try {
      const parsed = parseCompetitorUrl(scenario.url);
      const discovered = await discoverCompetitorPages(parsed.baseUrl, {
        submittedPageUrl: parsed.submittedPageUrl,
      });
      const pages = discovered
        .filter((page) => page.scrape.ok && page.scrape.rawText)
        .map((page) =>
          analyzePageIntelligence({
            pageType: page.pageType,
            scrape: page.scrape,
          }),
        );

      if (!pages.length) {
        return {
          ...scenario,
          duration_ms: Date.now() - start,
          pages: [],
          profile: null,
          facts: [],
          hashes: null,
          failures: ["No useful public pages found."],
          warnings: discovered
            .map((page) => page.scrape.error ?? page.scrape.errorType)
            .filter(Boolean)
            .slice(0, 5),
        };
      }

      const profile = buildBusinessProfile({ name: scenario.name, pages });

      return {
        ...scenario,
        duration_ms: Date.now() - start,
        pages,
        profile,
        facts: profileFacts(pages),
        hashes: profileHashes(profile),
        failures: [],
        warnings: [
          ...new Set([
            ...pages.flatMap((page) => page.warnings),
            ...profile.not_detected_reasons,
          ]),
        ].slice(0, 8),
      };
    } catch (error) {
      return {
        ...scenario,
        duration_ms: Date.now() - start,
        pages: [],
        profile: null,
        facts: [],
        hashes: null,
        failures: [
          error instanceof Error ? error.message : "Unexpected analysis failure.",
        ],
        warnings: [],
      };
    }
  }

  const analyzedSites = await mapLimit(uniqueScenarios, 6, async (scenario) => {
    const result = await analyzeScenarioSite(scenario);
    analysisCache.set(scenario.url, result);
    return result;
  });

  const caseResults = scenarios.map((scenario) => {
    const primary = analysisCache.get(scenario.url);
    const competitors = scenarioCompetitors(scenario).map((item) =>
      analysisCache.get(item.url),
    );
    const competitorSnapshots = competitors
      .filter((item) => item?.facts?.length)
      .map((item) => ({
        competitorName: item.name,
        facts: item.facts,
      }));
    const recommendations = buildProductRecommendations({
      productFacts: primary.facts,
      competitorSnapshots,
    });
    const pricing = pricingStatus(primary.profile);
    const positioning = positioningUseful(primary.profile) ? "useful" : "weak";
    const cta = ctaUseful(primary.profile) ? "useful" : "weak";
    const features = featureUseful(primary.profile) ? "useful" : "weak";
    const baseline =
      primary.profile && primary.hashes && primary.profile.watchlist_suggestions.length
        ? "useful"
        : "weak";
    const recommendation =
      recommendationUseful(recommendations) ? "useful_or_absent" : "weak";
    const failures = [
      ...primary.failures,
      pricingExpectationCorrect(scenario.expectedPricing, pricing)
        ? null
        : `Pricing expected ${scenario.expectedPricing}, detected ${pricing}.`,
      positioning === "useful" ? null : "Positioning weak or generic.",
      cta === "useful" ? null : "CTA missing or polluted.",
      features === "useful" ? null : "Feature evidence weak.",
      competitorSnapshots.length === 2 ? null : "Two competitor baselines missing.",
      recommendation === "useful_or_absent" ? null : "Recommendation weak.",
      baseline === "useful" ? null : "Baseline/watchlist weak.",
    ].filter(Boolean);

    return {
      name: scenario.name,
      url: scenario.url,
      category: scenario.category,
      success: failures.length === 0,
      pricing,
      expected_pricing: scenario.expectedPricing,
      pricing_false_positive: pricingFalsePositive(
        scenario.expectedPricing,
        pricing,
      ),
      positioning,
      cta,
      features,
      recommendation,
      confidence: primary.profile?.product_summary.confidence ?? "low",
      competitor_count: competitorSnapshots.length,
      baseline,
      duration_ms: primary.duration_ms,
      failures,
      warnings: primary.warnings,
    };
  });

  const pricingExpectedVisible = caseResults.filter(
    (item) => item.expected_pricing === "visible",
  );
  const pricingDetected = caseResults.filter((item) => item.pricing === "found");
  const pricingCorrectDetections = pricingDetected.filter(
    (item) => item.expected_pricing === "visible",
  );
  const pricingRecall = pct(
    pricingExpectedVisible.filter((item) => item.pricing === "found").length,
    pricingExpectedVisible.length,
  );
  const pricingPrecision = pct(
    pricingCorrectDetections.length,
    pricingDetected.length,
  );
  const dashboardSource = await read("src/app/dashboard/page.tsx");
  const homepageSource = await read("src/app/page.tsx");
  const dashboardClarity = scoreDashboardClarity(dashboardSource);
  const homepageTrust = scoreHomepageTrust(homepageSource);
  const uxLab = scoreUxLab({ dashboardClarity, homepageTrust, caseResults });
  const counterExamples = await runCounterExamples(
    analyzePageIntelligence,
    createDetectedChangePayload,
  );
  const performanceScore = pct(
    analyzedSites.filter((item) => item.duration_ms < 10000).length,
    analyzedSites.length,
  );
  const scorecard = {
    pricing_precision: pricingPrecision,
    pricing_recall: pricingRecall,
    positioning_precision: pct(
      caseResults.filter((item) => item.positioning === "useful").length,
      caseResults.length,
    ),
    cta_precision: pct(
      caseResults.filter((item) => item.cta === "useful").length,
      caseResults.length,
    ),
    feature_usefulness: pct(
      caseResults.filter((item) => item.features === "useful").length,
      caseResults.length,
    ),
    recommendation_usefulness: pct(
      caseResults.filter((item) => item.recommendation === "useful_or_absent")
        .length,
      caseResults.length,
    ),
    baseline_usefulness: pct(
      caseResults.filter((item) => item.baseline === "useful").length,
      caseResults.length,
    ),
    dashboard_clarity: dashboardClarity,
    homepage_trust: homepageTrust,
    performance: performanceScore,
    counterexample_score: pct(counterExamples.passed, counterExamples.total),
  };
  const finalScores = {
    reliability: boundedScore(
      average([
        pct(caseResults.filter((item) => item.success).length, caseResults.length),
        scorecard.baseline_usefulness,
        performanceScore,
        scorecard.counterexample_score,
      ]),
    ),
    ux: uxLab.score,
    trust: boundedScore(
      average([
        homepageTrust,
        scorecard.pricing_precision,
        scorecard.positioning_precision,
        scorecard.counterexample_score,
      ]),
    ),
    analyzer: boundedScore(
      average([
        scorecard.pricing_precision,
        scorecard.pricing_recall,
        scorecard.positioning_precision,
        scorecard.cta_precision,
        scorecard.feature_usefulness,
      ]),
    ),
    recommendation_quality: scorecard.recommendation_usefulness,
    cost_efficiency: openAiCalls === 0 ? 100 : 0,
    readiness: 0,
  };
  finalScores.readiness = boundedScore(
    average([
      finalScores.reliability,
      finalScores.ux,
      finalScores.trust,
      finalScores.analyzer,
      finalScores.recommendation_quality,
      finalScores.cost_efficiency,
    ]),
  );
  const gates = {
    reliability: finalScores.reliability >= 97,
    analyzer: finalScores.analyzer >= 95,
    ux: finalScores.ux >= 90,
    trust: finalScores.trust >= 90,
    recommendation: finalScores.recommendation_quality >= 85,
    cost: finalScores.cost_efficiency >= 90,
  };
  const failureCases = caseResults
    .filter((item) => !item.success)
    .sort((a, b) => b.failures.length - a.failures.length)
    .slice(0, 25);
  const failureCounts = caseResults.reduce((acc, item) => {
    for (const failure of item.failures) {
      const key = failure.replace(/ expected .+$/, " expected mismatch.");
      acc[key] = (acc[key] ?? 0) + 1;
    }

    return acc;
  }, {});
  const improvements = [
    scorecard.feature_usefulness < 90
      ? improvement(
          "Tighten feature extraction to reject CTAs, testimonials, generic blog headings, and vague proof-point copy.",
          "high",
          "low",
          "high",
        )
      : null,
    scorecard.pricing_recall < 95
      ? improvement(
          "Improve pricing page discovery and table/FAQ price extraction for pages where pricing is linked but not obvious from /pricing.",
          "high",
          "medium",
          "medium",
        )
      : null,
    scorecard.cta_precision < 95
      ? improvement(
          "Prioritize hero and above-the-fold CTAs over nav/footer/auth links more aggressively.",
          "high",
          "low",
          "high",
        )
      : null,
    scorecard.positioning_precision < 95
      ? improvement(
          "Add stricter positioning specificity checks and reject broad slogans without category/use-case support.",
          "medium",
          "low",
          "medium",
        )
      : null,
    performanceScore < 95
      ? improvement(
          "Add a validation-mode fetch budget and per-domain retry backoff for slow or blocking sites.",
          "medium",
          "medium",
          "medium",
        )
      : null,
    improvement(
      "Keep the V7 100-scenario suite as a prelaunch regression check before future READY claims.",
      "high",
      "low",
      "high",
      true,
    ),
  ].filter(Boolean);

  restoreResolver();
  globalThis.fetch = originalFetch;

  console.log(
    JSON.stringify(
      {
        ok: true,
        ai_enabled: false,
        openai_calls: openAiCalls,
        scenarios: scenarios.length,
        unique_urls_analyzed: analyzedSites.length,
        scorecard,
        final_scores: finalScores,
        gates,
        launch_decision: Object.values(gates).every(Boolean)
          ? "READY TO SHIP"
          : "NOT READY",
        failure_summary: Object.entries(failureCounts)
          .map(([failure, count]) => ({ failure, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
        failure_cases: failureCases,
        counterexamples: counterExamples,
        ux_lab: {
          score: uxLab.score,
          dropoffs: uxLab.dropoffs,
        },
        improvements,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(outDir, { recursive: true, force: true });
}
