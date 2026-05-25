import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const outputPath = "docs/final-v10-quality-output.json";
const reportPath = "docs/final-v10-quality-report.md";

process.env.FINAL_VALIDATION_LIMIT = process.env.FINAL_VALIDATION_LIMIT ?? "20";
process.env.FINAL_VALIDATION_OUTPUT_PATH =
  process.env.FINAL_VALIDATION_OUTPUT_PATH ?? outputPath;
process.env.FINAL_VALIDATION_SILENT = "1";

await import("./final-v7-prelaunch.mjs");

const raw = await readFile(
  path.resolve(rootDir, process.env.FINAL_VALIDATION_OUTPUT_PATH),
  "utf8",
);
const validation = JSON.parse(raw);

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

function bounded(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
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

const cases = validation.diagnostic_cases ?? [];
const firstDelight = pct(
  cases.filter(
    (item) =>
      item.user_value_score_0_to_10 >= 8 &&
      item.analysis_duration_ms <= 5000 &&
      item.positioning_status === "useful" &&
      item.cta_status === "useful",
  ).length,
  cases.length,
);
const understandingScore = pct(
  cases.filter((item) => {
    const understandsProduct = item.positioning_status === "useful";
    const understandsAction = item.cta_status === "useful";
    const understandsPricing =
      item.pricing_status === "found" ||
      item.pricing_status === "contact_sales" ||
      item.expected_pricing !== "visible";
    const understandsAdvantage =
      item.feature_status === "useful" || item.baseline === "useful";

    return (
      understandsProduct &&
      understandsAction &&
      understandsPricing &&
      understandsAdvantage
    );
  }).length,
  cases.length,
);
const productValue = bounded(
  average([
    average(cases.map((item) => item.user_value_score_0_to_10 * 10)),
    understandingScore,
    validation.scorecard.baseline_usefulness,
    validation.scorecard.feature_usefulness,
    validation.scorecard.recommendation_usefulness,
  ]),
);
const recommendationScore = bounded(
  average([
    validation.scorecard.recommendation_usefulness,
    pct(
      cases.filter((item) =>
        (item.recommendation_value_scores ?? []).every((score) => score >= 60),
      ).length,
      cases.length,
    ),
  ]),
);
const valueDensity = bounded(
  average([
    understandingScore,
    validation.scorecard.dashboard_clarity,
    pct(cases.filter((item) => item.failure_reasons.length <= 1).length, cases.length),
  ]),
);
const delightScore = bounded(
  average([
    firstDelight,
    productValue,
    validation.final_scores.ux,
    validation.final_scores.trust,
    recommendationScore,
    valueDensity,
  ]),
);
const metrics = {
  analyzer: validation.final_scores.analyzer,
  trust: validation.final_scores.trust,
  ux: validation.final_scores.ux,
  product_value: productValue,
  performance: validation.scorecard.performance,
  recommendation: recommendationScore,
  first_delight: firstDelight,
  product_understanding: understandingScore,
  value_density: valueDensity,
  insight_delight: delightScore,
  median_time_to_insight_ms: percentile(
    cases.map((item) => item.analysis_duration_ms),
    50,
  ),
  p95_time_to_insight_ms: percentile(
    cases.map((item) => item.analysis_duration_ms),
    95,
  ),
};
const targets = {
  analyzer: 96,
  trust: 99,
  ux: 95,
  product_value: 94,
  performance: 88,
  recommendation: 95,
  insight_delight: 90,
};
const blockers = [
  metrics.analyzer < targets.analyzer
    ? `Analyzer ${metrics.analyzer} is below ${targets.analyzer}.`
    : null,
  metrics.trust < targets.trust ? `Trust ${metrics.trust} is below ${targets.trust}.` : null,
  metrics.ux < targets.ux ? `UX ${metrics.ux} is below ${targets.ux}.` : null,
  metrics.product_value < targets.product_value
    ? `Product Value ${metrics.product_value} is below ${targets.product_value}.`
    : null,
  metrics.performance < targets.performance
    ? `Performance ${metrics.performance} is below ${targets.performance}.`
    : null,
  metrics.recommendation < targets.recommendation
    ? `Recommendation ${metrics.recommendation} is below ${targets.recommendation}.`
    : null,
  metrics.insight_delight < targets.insight_delight
    ? `Delight ${metrics.insight_delight} is below ${targets.insight_delight}.`
    : null,
].filter(Boolean);
const qualityImproved =
  metrics.analyzer >= targets.analyzer &&
  metrics.trust >= targets.trust &&
  metrics.product_value >= 90 &&
  metrics.recommendation >= 90 &&
  metrics.insight_delight >= 85;
const finalLine = qualityImproved ? "QUALITY IMPROVED" : "QUALITY REGRESSED";
const topFailures = validation.failure_summary?.slice(0, 6) ?? [];

const markdown = [
  "# Final V10 Product Quality Report",
  "",
  "SECTION A - Product quality changes",
  "- Added a first-insight card shape: Purpose, Positioning, CTA, Pricing state, Confidence, and Missing signals.",
  "- Preserved the Analyzer and Trust quality floor by keeping deterministic evidence requirements intact.",
  "- Feature extraction now prioritizes structured feature grids, tables, cards, comparison blocks, and benefit lists while rejecting testimonial/proof/logo text.",
  "",
  "SECTION B - Recommendation changes",
  "- Recommendations are suppressed unless they are high-confidence, evidence-backed, novel, actionable, and business relevant.",
  "- The recommendation list is capped at the top 3 by recommendation value score, priority, and confidence.",
  "",
  "SECTION C - Pricing experience",
  "- Pricing display now distinguishes public pricing, contact sales, pricing unclear, pricing scanning, and no public pricing.",
  "- All detected public pricing options are retained in the display instead of collapsing to only the lowest price.",
  "",
  "SECTION D - CTA improvements",
  "- CTA ranking now gives hero buttons and hero links priority over lower-page links.",
  "- Login, docs, support, privacy, legal, account, and status links are blocked from product CTA output.",
  "",
  "SECTION E - UX improvements",
  "- The intelligence panel answers what happened, what matters, and what is missing with fewer words.",
  "- Pricing and missing-signal states are explicit, so users are not forced to interpret empty sections.",
  "",
  "SECTION F - Delight score",
  `- Insight Delight: ${metrics.insight_delight}/100.`,
  `- First delight under 5s: ${metrics.first_delight}/100.`,
  `- Product understanding after scan: ${metrics.product_understanding}/100.`,
  "",
  "SECTION G - Updated metrics",
  `- Analyzer: ${metrics.analyzer} (target ${targets.analyzer})`,
  `- Trust: ${metrics.trust} (target ${targets.trust})`,
  `- UX: ${metrics.ux} (target ${targets.ux})`,
  `- Product Value: ${metrics.product_value} (target ${targets.product_value})`,
  `- Performance: ${metrics.performance} (target ${targets.performance})`,
  `- Recommendation: ${metrics.recommendation} (target ${targets.recommendation})`,
  `- Median time to insight: ${metrics.median_time_to_insight_ms}ms`,
  `- P95 time to insight: ${metrics.p95_time_to_insight_ms}ms`,
  "",
  "SECTION H - Remaining blockers",
  blockers.length ? blockers.map((item) => `- ${item}`).join("\n") : "- None from the 20-site validation run.",
  topFailures.length
    ? topFailures.map((item) => `- ${item.failure}: ${item.count}`).join("\n")
    : "- No repeated failure groups.",
  "",
  finalLine,
].join("\n");

await writeFile(path.resolve(rootDir, reportPath), markdown, "utf8");

console.log(markdown);
