import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    const trust = evidence?.trust ?? {};
    const valueScore = Number(trust.recommendation_value_score ?? 0);
    const adversarialSurvives =
      trust.adversarial_review?.survives === true;
    const title = recommendation.title.toLowerCase();

    return (
      recommendation.confidence >= 60 &&
      valueScore >= 55 &&
      adversarialSurvives &&
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
    const fastEnough = result.duration_ms < 8000;
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

function percentile(values, target) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((target / 100) * sorted.length) - 1,
  );

  return sorted[index];
}

function median(values) {
  return percentile(values, 50);
}

function scoreAttentionClarity({ dashboardClarity, homepageTrust, caseResults }) {
  const firstInsightFast = caseResults.filter(
    (item) => item.duration_ms <= 45_000 && item.baseline === "useful",
  ).length;
  const successfulIntelligence = caseResults.filter(
    (item) =>
      item.positioning === "useful" &&
      item.cta === "useful" &&
      item.features !== "weak",
  ).length;

  return boundedScore(
    average([
      dashboardClarity,
      homepageTrust,
      pct(firstInsightFast, caseResults.length),
      pct(successfulIntelligence, caseResults.length),
    ]),
  );
}

function decisionFrictionIndex({ dashboardClarity, caseResults }) {
  const weakSignals = caseResults.filter(
    (item) =>
      item.positioning === "weak" ||
      item.cta === "weak" ||
      item.baseline === "weak" ||
      item.duration_ms > 8000,
  ).length;

  return boundedScore(100 - average([dashboardClarity, 100 - pct(weakSignals, caseResults.length)]));
}

function evidenceStatus(facts) {
  if (!facts.length) {
    return "none";
  }

  const withEvidence = facts.filter(
    (fact) => fact.source_url && fact.evidence_text,
  ).length;

  if (withEvidence === facts.length) {
    return "complete";
  }

  return withEvidence ? "partial" : "missing";
}

function userValueScore({
  status,
  pricing,
  positioning,
  cta,
  features,
  baseline,
  evidence,
  durationMs,
}) {
  const score =
    (status === "pass" ? 2 : status === "partial" ? 1 : 0) +
    (pricing === "found" || pricing === "contact_sales" ? 1.5 : 0) +
    (positioning === "useful" ? 1.5 : 0) +
    (cta === "useful" ? 1 : 0) +
    (features === "useful" ? 1 : 0) +
    (baseline === "useful" ? 1 : 0) +
    (evidence === "complete" ? 1 : evidence === "partial" ? 0.5 : 0) +
    (durationMs < 3000 ? 1 : durationMs < 8000 ? 0.5 : 0);

  return Math.max(0, Math.min(10, Number(score.toFixed(1))));
}

function preciseFailureReason({
  failure,
  primary,
  pricing,
  positioning,
  cta,
  features,
}) {
  const warnings = (primary.warnings ?? []).join(" ");

  if (/No useful public pages found/i.test(failure)) {
    return primary.warnings?.length
      ? `all discovered candidate pages failed or returned no meaningful static text: ${primary.warnings.join("; ")}`
      : "all discovered candidate pages failed or returned no meaningful static text";
  }

  if (/Pricing expected visible/i.test(failure)) {
    if (/timeout/i.test(warnings)) {
      return "pricing was expected in the public fixture, but one or more pricing candidates timed out before deterministic extraction";
    }

    if (/JavaScript-heavy|app shell/i.test(warnings)) {
      return "pricing likely requires client-side rendering; static HTML did not expose a reliable price";
    }

    if (pricing === "contact_sales") {
      return "pricing expected as visible, but extracted evidence only supported a contact-sales pricing path";
    }

    return "pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules";
  }

  if (/Pricing expected contact_sales/i.test(failure)) {
    return "contact-sales fixture produced a visible-price classification, indicating pricing precision risk for enterprise pages";
  }

  if (/CTA missing or polluted/i.test(failure)) {
    const primaryCta = primary.profile?.conversion.primary_cta;

    return primaryCta
      ? `CTA did not pass usefulness check; extracted CTA was "${primaryCta}", likely passive, nav, or low-intent`
      : "no non-auth hero/link/button CTA survived ranking";
  }

  if (/Feature evidence weak/i.test(failure)) {
    const featureCount = primary.profile?.product_capabilities.features.length ?? 0;

    return `only ${featureCount} reliable feature facts were extracted; target is at least 3 clear feature/product signals`;
  }

  if (/Positioning weak or generic/i.test(failure)) {
    return positioning === "weak"
      ? "positioning lacked a clear category, target customer, use case, or non-generic value proposition"
      : failure;
  }

  if (/Two competitor baselines missing/i.test(failure)) {
    return "comparison context was incomplete because fewer than two same-category competitor baselines produced facts";
  }

  if (/Baseline\/watchlist weak/i.test(failure)) {
    return "baseline did not produce enough structured profile hashes or watchlist suggestions";
  }

  if (/Recommendation weak/i.test(failure)) {
    return "recommendation was suppressed or lacked enough competitor evidence, novelty, or adversarial-review strength";
  }

  return failure;
}

function limitationsForCase({
  primary,
  pricing,
  cta,
  features,
  positioning,
  status,
}) {
  if (status === "pass") {
    return [];
  }

  const limitations = [];
  const warnings = (primary.warnings ?? []).join(" ");

  if (!primary.pages_successful) {
    limitations.push("static analyzer could not obtain useful public HTML from selected candidates");
  }

  if (pricing !== "found" && pricing !== "contact_sales") {
    limitations.push("pricing may require deeper discovery, interaction, or client-rendered content");
  }

  if (cta === "weak") {
    limitations.push("CTA ranking may miss hero actions or reject passive but intentional CTAs");
  }

  if (features === "weak") {
    limitations.push("feature extraction needs clearer product sections and does not infer features from vague marketing copy");
  }

  if (positioning === "weak") {
    limitations.push("positioning extraction rejects broad slogans without category or audience evidence");
  }

  if (/sitemap/i.test(warnings)) {
    limitations.push("sitemap expansion is budgeted and may skip slow sitemap branches");
  }

  if (/JavaScript-heavy|app shell/i.test(warnings)) {
    limitations.push("static analyzer cannot see client-rendered sections without browser fallback");
  }

  if (/403|blocked|robots/i.test(warnings)) {
    limitations.push("site blocks automated fetches or robots rules prevent analysis");
  }

  if (primary.duration_ms > 8000) {
    limitations.push("scan exceeded the V9 useful-insight time budget");
  }

  return Array.from(new Set(limitations));
}

function fixForCase({ pricing, cta, features, positioning, primary }) {
  if (!primary.pages_successful) {
    return {
      recommended_fix:
        "Add blocked/JS-heavy classification plus background browser fallback for admin-reviewed cases.",
      fix_difficulty: "high",
      fix_priority: "high",
    };
  }

  if (pricing !== "found" && pricing !== "contact_sales") {
    return {
      recommended_fix:
        "Queue targeted pricing-only retries for pricing/plans/packages/FAQ candidates instead of rerunning full scans.",
      fix_difficulty: "medium",
      fix_priority: "high",
    };
  }

  if (cta === "weak") {
    return {
      recommended_fix:
        "Improve CTA precedence so hero and above-the-fold conversion links beat nav/footer/passive links.",
      fix_difficulty: "low",
      fix_priority: "high",
    };
  }

  if (features === "weak") {
    return {
      recommended_fix:
        "Tighten feature section detection and add table/card parsing without using testimonial/proof text.",
      fix_difficulty: "medium",
      fix_priority: "medium",
    };
  }

  if (positioning === "weak") {
    return {
      recommended_fix:
        "Add a stricter homepage hero/category fallback using title, meta description, H1, and first paragraph only.",
      fix_difficulty: "low",
      fix_priority: "medium",
    };
  }

  if (primary.duration_ms > 8000) {
    return {
      recommended_fix:
        "Deliver homepage-derived intelligence first and move deeper discovery to background retries.",
      fix_difficulty: "medium",
      fix_priority: "high",
    };
  }

  return {
    recommended_fix: "No immediate fix; monitor for regressions.",
    fix_difficulty: "low",
    fix_priority: "low",
  };
}

function diagnosticStatus({ failures, primary }) {
  if (!failures.length) {
    return "pass";
  }

  if (!primary.pages_successful || primary.failures.length) {
    return "fail";
  }

  return "partial";
}

function rootCauseForFailure(reason) {
  if (/pricing.*timed out|time budget|exceeded/i.test(reason)) {
    return "timeout / performance";
  }

  if (/pricing.*client-side|JavaScript|app shell/i.test(reason)) {
    return "JS-rendering limitation";
  }

  if (/pricing expected|currency-plus-billing|contact-sales/i.test(reason)) {
    return "pricing discovery or parsing failure";
  }

  if (/CTA/i.test(reason)) {
    return "CTA ranking failure";
  }

  if (/feature/i.test(reason)) {
    return "feature extraction noise or scarcity";
  }

  if (/positioning/i.test(reason)) {
    return "positioning specificity failure";
  }

  if (/candidate pages failed|blocked|403|robots/i.test(reason)) {
    return "blocked or unavailable site";
  }

  if (/comparison context|competitor baselines/i.test(reason)) {
    return "comparison baseline coverage";
  }

  if (/baseline/i.test(reason)) {
    return "baseline/watchlist coverage";
  }

  return "other diagnostic failure";
}

function rootCauseGroups(cases) {
  const groups = new Map();

  for (const item of cases) {
    for (const reason of item.failure_reasons) {
      const key = rootCauseForFailure(reason);
      const group = groups.get(key) ?? {
        root_cause: key,
        affected_cases: 0,
        severity: "medium",
        examples: [],
      };

      group.affected_cases += 1;

      if (group.examples.length < 5) {
        group.examples.push(`${item.name}: ${reason}`);
      }

      groups.set(key, group);
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const severe =
        group.affected_cases >= 10 ||
        /pricing|blocked|timeout|JS/.test(group.root_cause);

      return {
        ...group,
        severity: severe ? "high" : group.affected_cases >= 5 ? "medium" : "low",
        likely_root_cause: likelyRootCause(group.root_cause),
        recommended_fix: groupFix(group.root_cause),
        estimated_implementation_difficulty: groupDifficulty(group.root_cause),
        expected_reliability_gain: groupGain(group.affected_cases),
      };
    })
    .sort((a, b) => b.affected_cases - a.affected_cases);
}

function likelyRootCause(rootCause) {
  const values = {
    "pricing discovery or parsing failure":
      "pricing pages are non-standard, require interaction, or expose prices in layouts the deterministic extractor does not yet model",
    "CTA ranking failure":
      "CTA extraction is still too dependent on detected links/buttons and can miss intended hero actions",
    "feature extraction noise or scarcity":
      "feature sections are sparse, card-like, or mixed with testimonial/proof content",
    "positioning specificity failure":
      "homepage copy lacks explicit category/audience/use-case signals or those signals are not prioritized",
    "blocked or unavailable site":
      "target site blocks automated requests, exposes an empty app shell, or returns unusable static HTML",
    "timeout / performance":
      "scan waits on slow external pages before user-visible value is delivered",
    "JS-rendering limitation":
      "important content is rendered client-side and absent from static HTML",
    "comparison baseline coverage":
      "same-category comparator sites failed or returned too little evidence",
    "baseline/watchlist coverage":
      "structured facts were too sparse to create a useful watchlist",
  };

  return values[rootCause] ?? "uncategorized validation failure";
}

function groupFix(rootCause) {
  const values = {
    "pricing discovery or parsing failure":
      "add targeted pricing-only retries and support plan tables/toggles without blocking first insight",
    "CTA ranking failure":
      "prioritize hero/above-the-fold CTAs over nav/footer and classify passive CTAs separately",
    "feature extraction noise or scarcity":
      "improve feature-card/table parsing and keep testimonial/proof text out of features",
    "positioning specificity failure":
      "limit fallback to title/meta/H1/hero/first paragraph and downgrade broad slogans",
    "blocked or unavailable site":
      "classify blocked/JS-heavy sites clearly and optionally retry in background with browser fallback",
    "timeout / performance":
      "decouple homepage insight from deep discovery and move slow pricing/docs/sitemap work to background",
    "JS-rendering limitation":
      "background browser fallback for JS-heavy pages with strict cost guard",
    "comparison baseline coverage":
      "cache comparator baselines and avoid treating missing comparators as product-analysis failure",
    "baseline/watchlist coverage":
      "generate watchlist from available dimensions and label missing dimensions explicitly",
  };

  return values[rootCause] ?? "inspect failed case manually";
}

function groupDifficulty(rootCause) {
  if (/CTA ranking|positioning|baseline/.test(rootCause)) {
    return "low";
  }

  if (/pricing|timeout|comparison|feature/.test(rootCause)) {
    return "medium";
  }

  return "high";
}

function groupGain(affectedCases) {
  if (affectedCases >= 12) {
    return "high";
  }

  if (affectedCases >= 5) {
    return "medium";
  }

  return "low";
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

  const { discoverCompetitorPages, getCandidateUrls } = require(path.join(
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
      const candidateUrls = getCandidateUrls(parsed.baseUrl, {
        submittedPageUrl: parsed.submittedPageUrl,
      });
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
          pages_attempted: candidateUrls.length,
          pages_successful: 0,
          pages_failed: candidateUrls.length,
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
        pages_attempted: candidateUrls.length,
        pages_successful: pages.length,
        pages_failed: Math.max(0, candidateUrls.length - pages.length),
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
        pages_attempted: 0,
        pages_successful: 0,
        pages_failed: 0,
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

  const caseResults = scenarios.map((scenario, index) => {
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
    const status = diagnosticStatus({ failures, primary });
    const evidence = evidenceStatus(primary.facts);
    const failureReasons = failures.map((failure) =>
      preciseFailureReason({
        failure,
        primary,
        pricing,
        positioning,
        cta,
        features,
      }),
    );
    const currentLimitations = limitationsForCase({
      primary,
      pricing,
      cta,
      features,
      positioning,
      status,
    });
    const fix = fixForCase({
      pricing,
      cta,
      features,
      positioning,
      primary,
    });

    return {
      case_number: index + 1,
      name: scenario.name,
      url: scenario.url,
      category: scenario.category,
      status,
      success: failures.length === 0,
      analysis_duration_ms: primary.duration_ms,
      pages_attempted: primary.pages_attempted ?? 0,
      pages_successful: primary.pages_successful ?? primary.pages.length,
      pages_failed: primary.pages_failed ?? 0,
      pricing,
      pricing_status: pricing,
      pricing_plans_detected: primary.profile?.monetization.plans.length ?? 0,
      expected_pricing: scenario.expectedPricing,
      pricing_false_positive: pricingFalsePositive(
        scenario.expectedPricing,
        pricing,
      ),
      positioning,
      positioning_status: positioning,
      cta,
      cta_status: cta,
      features,
      feature_status: features,
      changelog_status: primary.profile?.momentum.changelog_detected
        ? "found"
        : "not_detected",
      availability_status: primary.profile?.availability.status ?? "failed",
      evidence_status: evidence,
      user_value_score_0_to_10: userValueScore({
        status,
        pricing,
        positioning,
        cta,
        features,
        baseline,
        evidence,
        durationMs: primary.duration_ms,
      }),
      recommendation,
      recommendation_titles: recommendations.map((item) => item.title),
      recommendation_value_scores: recommendations
        .map((item) => item.evidence_json?.trust?.recommendation_value_score)
        .filter((value) => typeof value === "number"),
      confidence: primary.profile?.product_summary.confidence ?? "low",
      competitor_count: competitorSnapshots.length,
      baseline,
      duration_ms: primary.duration_ms,
      failures,
      failure_reasons: failureReasons,
      current_limitations: currentLimitations,
      ...fix,
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
  const durations = analyzedSites.map((item) => item.duration_ms);
  const medianDurationMs = median(durations);
  const p95DurationMs = percentile(durations, 95);
  const attentionClarity = scoreAttentionClarity({
    dashboardClarity,
    homepageTrust,
    caseResults,
  });
  const decisionFriction = decisionFrictionIndex({
    dashboardClarity,
    caseResults,
  });
  const timeToFirstInsightSeconds = Math.round(
    median(caseResults.map((item) => item.duration_ms)) / 1000,
  );
  const behavioralPass = boundedScore(
    average([
      uxLab.score,
      attentionClarity,
      pct(
        caseResults.filter(
          (item) => item.success || item.failures.length <= 1,
        ).length,
        caseResults.length,
      ),
    ]),
  );
  const counterExamples = await runCounterExamples(
    analyzePageIntelligence,
    createDetectedChangePayload,
  );
  const performanceScore = pct(
    analyzedSites.filter((item) => item.duration_ms < 8000).length,
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
    median_duration_ms: medianDurationMs,
    p95_duration_ms: p95DurationMs,
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
    recommendation_acceptance: boundedScore(
      scorecard.recommendation_usefulness * 0.75 +
        scorecard.baseline_usefulness * 0.25,
    ),
    attention_clarity: attentionClarity,
    decision_friction_index: decisionFriction,
    time_to_first_insight_seconds: timeToFirstInsightSeconds,
    behavioral_pass: behavioralPass,
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
      finalScores.recommendation_acceptance,
      finalScores.attention_clarity,
      finalScores.behavioral_pass,
      finalScores.cost_efficiency,
    ]),
  );
  const gates = {
    reliability: finalScores.reliability >= 97,
    analyzer: finalScores.analyzer >= 95,
    ux: finalScores.ux >= 95,
    trust: finalScores.trust >= 90,
    recommendation: finalScores.recommendation_quality >= 90,
    recommendation_acceptance: finalScores.recommendation_acceptance >= 85,
    attention_clarity: finalScores.attention_clarity >= 90,
    decision_friction: finalScores.decision_friction_index <= 20,
    time_to_first_insight: finalScores.time_to_first_insight_seconds <= 45,
    behavioral_pass: finalScores.behavioral_pass >= 90,
    performance:
      scorecard.performance >= 95 &&
      scorecard.median_duration_ms < 4000 &&
      scorecard.p95_duration_ms < 8000,
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

  const report = {
        ok: true,
        ai_enabled: false,
        openai_calls: openAiCalls,
        scenarios: scenarios.length,
        unique_urls_analyzed: analyzedSites.length,
        scorecard,
        final_scores: finalScores,
        gates,
        diagnostic_cases: caseResults.map((item) => ({
          case_number: item.case_number,
          name: item.name,
          url: item.url,
          category: item.category,
          status: item.status,
          analysis_duration_ms: item.analysis_duration_ms,
          pages_attempted: item.pages_attempted,
          pages_successful: item.pages_successful,
          pages_failed: item.pages_failed,
          pricing_status: item.pricing_status,
          pricing_plans_detected: item.pricing_plans_detected,
          positioning_status: item.positioning_status,
          cta_status: item.cta_status,
          feature_status: item.feature_status,
          changelog_status: item.changelog_status,
          availability_status: item.availability_status,
          evidence_status: item.evidence_status,
          user_value_score_0_to_10: item.user_value_score_0_to_10,
          failure_reasons: item.failure_reasons,
          current_limitations: item.current_limitations,
          recommended_fix: item.recommended_fix,
          fix_difficulty: item.fix_difficulty,
          fix_priority: item.fix_priority,
        })),
        root_cause_groups: rootCauseGroups(caseResults),
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
      };

  if (process.env.FINAL_V9_OUTPUT_PATH) {
    await writeFile(
      path.resolve(rootDir, process.env.FINAL_V9_OUTPUT_PATH),
      JSON.stringify(report, null, 2),
      "utf8",
    );
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(outDir, { recursive: true, force: true });
}
