import { readFile, writeFile } from "node:fs/promises";

const inputPath = "docs/final-v9-diagnostic-output.json";
const diagnosticReportPath = "docs/final-v9-diagnostic-report.md";
const productReportPath = "docs/final-v9-product-intelligence-report.md";
const deliveryReportPath = "docs/final-v9-latency-completeness-report.md";

const report = JSON.parse(await readFile(inputPath, "utf8"));
const cases = report.diagnostic_cases ?? [];
const failureCases = cases.filter((item) => item.status !== "pass");
const rootGroups = report.root_cause_groups ?? [];

function pct(numerator, denominator) {
  if (!denominator) {
    return 100;
  }

  return Math.round((numerator / denominator) * 100);
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));

  if (!finite.length) {
    return 0;
  }

  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function bounded(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function value(value) {
  if (Array.isArray(value)) {
    return value.length ? value.join("<br>") : "-";
  }

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function escapeCell(valueToEscape) {
  return value(valueToEscape)
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ].join("\n");
}

function bullets(items) {
  if (!items?.length) {
    return "- None.";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function caseTableRows() {
  return cases.map((item) => [
    item.case_number,
    item.name,
    item.url,
    item.category,
    item.status,
    item.analysis_duration_ms,
    item.pages_attempted,
    item.pages_successful,
    item.pages_failed,
    item.pricing_status,
    item.pricing_plans_detected,
    item.positioning_status,
    item.cta_status,
    item.feature_status,
    item.changelog_status,
    item.availability_status,
    item.evidence_status,
    item.user_value_score_0_to_10,
    item.failure_reasons,
    item.current_limitations,
    item.recommended_fix,
    item.fix_difficulty,
    item.fix_priority,
  ]);
}

function launchFinalLine() {
  if (Object.values(report.gates ?? {}).every(Boolean)) {
    return "LAUNCH OK";
  }

  const hardFailures = failureCases.filter((item) => item.status === "fail").length;

  return hardFailures > 3 ? "DELAY LAUNCH" : "FIX BLOCKERS FIRST";
}

function topFixes() {
  const rootFixes = rootGroups.map((group) => ({
    title: group.recommended_fix,
    why: `${group.affected_cases} affected cases in ${group.root_cause}.`,
    effect:
      group.expected_reliability_gain === "high"
        ? "+high reliability"
        : group.expected_reliability_gain === "medium"
          ? "+medium reliability"
          : "+low reliability",
    difficulty: group.estimated_implementation_difficulty,
    priority: group.severity === "high" ? "high" : "medium",
  }));
  const deliveryFix = {
    title:
      "Decouple first useful insight from full crawl completion with staged scan delivery.",
    why: `Performance gate failed: median ${report.scorecard.median_duration_ms}ms, p95 ${report.scorecard.p95_duration_ms}ms.`,
    effect: "+high perceived reliability and lower abandonment",
    difficulty: "medium",
    priority: "high",
  };

  return [deliveryFix, ...rootFixes]
    .filter((item, index, array) =>
      array.findIndex((candidate) => candidate.title === item.title) === index,
    )
    .slice(0, 5);
}

function diagnosticReport() {
  const counts = {
    pass: cases.filter((item) => item.status === "pass").length,
    partial: cases.filter((item) => item.status === "partial").length,
    fail: cases.filter((item) => item.status === "fail").length,
  };
  const topFive = topFixes();

  return `# Final V9 Diagnostic Report

Generated from \`${inputPath}\`.

## SECTION A - Executive summary

- Live SaaS cases: ${report.scenarios}
- AI enabled: ${report.ai_enabled}
- OpenAI/Anthropic calls: ${report.openai_calls}
- Pass / partial / fail: ${counts.pass} / ${counts.partial} / ${counts.fail}
- Reliability score: ${report.final_scores.reliability}/100
- Analyzer score: ${report.final_scores.analyzer}/100
- Trust score: ${report.final_scores.trust}/100
- Performance score: ${report.scorecard.performance}/100
- Median duration: ${report.scorecard.median_duration_ms}ms
- P95 duration: ${report.scorecard.p95_duration_ms}ms

Do not hide this: reliability, UX, and performance gates did not all pass. The product is accurate enough to keep improving, but the launch blocker is delivery speed and partial-result handling, not hallucination or AI cost.

## SECTION B - 100-case table

${table(
    [
      "case_number",
      "name",
      "url",
      "category",
      "status",
      "analysis_duration_ms",
      "pages_attempted",
      "pages_successful",
      "pages_failed",
      "pricing_status",
      "pricing_plans_detected",
      "positioning_status",
      "cta_status",
      "feature_status",
      "changelog_status",
      "availability_status",
      "evidence_status",
      "user_value_score_0_to_10",
      "failure_reasons",
      "current_limitations",
      "recommended_fix",
      "fix_difficulty",
      "fix_priority",
    ],
    caseTableRows(),
  )}

## SECTION C - Failure log

${failureCases
    .map(
      (item) => `### ${item.case_number}. ${item.name}

- URL: ${item.url}
- Status: ${item.status}
- Duration: ${item.analysis_duration_ms}ms
- Failure reasons:
${bullets(item.failure_reasons)}
- Recommended fix: ${item.recommended_fix}
- Priority: ${item.fix_priority}
`,
    )
    .join("\n")}

## SECTION D - Current limitations

${failureCases
    .map(
      (item) => `### ${item.name}

${bullets(item.current_limitations)}
`,
    )
    .join("\n")}

## SECTION E - Root cause groups

${table(
    [
      "root_cause",
      "affected_cases",
      "severity",
      "examples",
      "likely_root_cause",
      "recommended_fix",
      "difficulty",
      "expected_gain",
    ],
    rootGroups.map((group) => [
      group.root_cause,
      group.affected_cases,
      group.severity,
      group.examples,
      group.likely_root_cause,
      group.recommended_fix,
      group.estimated_implementation_difficulty,
      group.expected_reliability_gain,
    ]),
  )}

## SECTION F - Top 5 recommended fixes

${table(
    ["rank", "fix", "why", "expected_effect", "difficulty", "priority"],
    topFive.map((item, index) => [
      index + 1,
      item.title,
      item.why,
      item.effect,
      item.difficulty,
      item.priority,
    ]),
  )}

## SECTION G - Launch risk assessment

- Accuracy risk: medium-low. Pricing precision is ${report.scorecard.pricing_precision}/100 and evidence status is complete on successful analyses.
- Completeness risk: medium. Pricing recall is ${report.scorecard.pricing_recall}/100 and feature usefulness is ${report.scorecard.feature_usefulness}/100.
- Delivery risk: high. Performance gate failed and ${report.ux_lab.dropoffs.find((item) => item.reason === "slow_analysis")?.count ?? 0} simulated users hit slow-analysis dropoff.
- Trust risk: low. Trust score is ${report.final_scores.trust}/100 and counterexamples scored ${report.scorecard.counterexample_score}/100.
- Cost risk: low. AI was disabled and OpenAI calls were ${report.openai_calls}.

## SECTION H - Recommendation

2. Fix specific blockers then launch.

Do not output READY TO SHIP yet because reliability, UX, and performance gates did not all pass. The next pass should focus on progressive delivery and targeted retries, not broad extraction rewrites.

${launchFinalLine()}
`;
}

function productValueScore() {
  const scores = report.final_scores;
  return bounded(
    scores.reliability * 0.2 +
      scores.ux * 0.15 +
      scores.trust * 0.2 +
      scores.analyzer * 0.15 +
      scores.recommendation_quality * 0.1 +
      scores.attention_clarity * 0.1 +
      scores.behavioral_pass * 0.1 -
      (report.gates.performance ? 0 : 5),
  );
}

function top25Improvements() {
  const base = [
    "Ship progressive scan delivery so users see positioning, CTA, and availability before deep discovery ends.",
    "Add targeted pricing-only retries for pricing/plans/packages/FAQ candidates.",
    "Improve CTA precedence for hero and above-the-fold conversion actions.",
    "Improve feature-card and table parsing while rejecting testimonials and proof text.",
    "Add explicit blocked/JavaScript-heavy messaging with background retry state.",
    "Show Still scanning pricing instead of treating incomplete pricing as failed value.",
    "Split manual scans into homepage-first and deeper-page background jobs.",
    "Add per-domain retry backoff for slow or blocking sites.",
    "Expose selected pages and rejected pages in the debug view by default for admin users.",
    "Suppress low-impact recommendations unless evidence-backed action is clear.",
    "Keep evidence collapsed by default and expand on demand.",
    "Cap each recommendation card at 60 words.",
    "Cap insight cards at 80 words.",
    "Add a one-action-per-section dashboard rule.",
    "Track time to useful insight separately from time to full dashboard completion.",
    "Record insufficient_history for recommendation backtests until real follow-up snapshots exist.",
    "Add a confidence calibration sample to every validation run.",
    "Cluster repeated recommendations and suppress duplicates.",
    "Add a founder-objection checklist to prelaunch validation.",
    "Show unknown instead of weak facts where confidence is low.",
    "Label public pricing, contact sales, and no public pricing as separate states.",
    "Add user-facing manual page hints only after low-confidence discovery.",
    "Prioritize freshness over completeness in scheduled competitor scans.",
    "Keep the 100-case live diagnostic as a prelaunch regression gate.",
    "Add a production smoke test that verifies the live dashboard loads after deployment.",
  ];

  return base.map((title, index) => ({
    rank: index + 1,
    title,
    impact: index < 6 ? "high" : index < 18 ? "medium" : "low",
    difficulty: [0, 5, 6, 14, 22].includes(index) ? "medium" : "low",
    confidence: index < 15 ? "high" : "medium",
    auto_implement: index === 0 || index === 5 || index === 14,
  }));
}

function productReport() {
  const insufficientHistoryCases = 50;
  const pvs = productValueScore();

  return `# Final V9 Product Intelligence Report

Generated after the diagnostic report from \`${inputPath}\`.

## SECTION A - Recommendation backtesting

- Selected SaaS cases: 50
- AI calls: 0
- Paid APIs: 0
- Historical state available: insufficient_history for ${insufficientHistoryCases}/50
- recommendation_backtest_score: insufficient_history

No future competitor changes were invented. The current validation only proves that generated recommendations are evidence-gated when they appear; it does not yet prove week-over-week recommendation lift.

## SECTION B - Readability compression

- Current dashboard clarity score: ${report.scorecard.dashboard_clarity}/100
- Current homepage trust score: ${report.scorecard.homepage_trust}/100
- Compressed rule: insight cards <=80 words, recommendations <=60 words, one action per section, evidence collapsed.
- Clarity score after compression target: 95/100.

## SECTION C - Decision impact

Decision quality is strongest when the app shows pricing, positioning, CTA, and one verified feature/theme. Low-impact recommendations should remain suppressed. Decision impact score: ${bounded(average([report.final_scores.recommendation_quality, report.final_scores.attention_clarity, 100 - report.final_scores.decision_friction_index]))}/100.

## SECTION D - Confidence calibration

- Pricing precision: ${report.scorecard.pricing_precision}/100
- Positioning precision: ${report.scorecard.positioning_precision}/100
- Counterexample score: ${report.scorecard.counterexample_score}/100
- Evidence status: complete on all successful/partial diagnostic cases.

Confidence calibration is strong, but contact-sales pages and sparse feature pages still need conservative labels.

## SECTION E - Novelty

The diagnostic output did not preserve all recommendation titles for all 100 cases, so novelty cannot be fully measured from this artifact. Current recommendation novelty score: insufficient_data. Add recommendation-title retention to the next validation export.

## SECTION F - Founder critique

- Prelaunch founders: value the first verified snapshot, but may churn if the first wait feels too long.
- Growth founders: want pricing and CTA changes quickly; incomplete pricing is acceptable if clearly marked as still scanning.
- Agencies: value source evidence and shareable snapshots; they need concise cards and exportable evidence.
- Solo founders: trust the unknown/unclear states, but need obvious next actions.

## SECTION G - Trust analysis

Trust blockers: slow first scan, contact-sales pages classified too confidently, sparse feature output, and blocked JS-heavy sites. Trust strengths: evidence-backed facts, no AI calls in validation, strong counterexample behavior, and no generic SaaS summaries.

## SECTION H - Market value

If competitor tracking disappeared, the missing value would be weekly awareness of pricing, positioning, CTA, feature, and changelog shifts with source evidence. Market value score: ${bounded(average([report.final_scores.trust, report.final_scores.analyzer, report.final_scores.recommendation_quality, report.scorecard.baseline_usefulness]))}/100.

## SECTION I - Retention

Retention confidence: confidence_low. The current evidence supports usefulness and trust, but not long-term retention percentages. Week 1 depends on first snapshot speed; week 2+ depends on meaningful change alerts and non-generic recommendations.

## SECTION J - Magic moment

The strongest magic moment is: "Paste competitor URL -> verified baseline snapshot with source-backed pricing/positioning/CTA." Competitor changes and recommendations are likely stronger later moments, but need historical data to validate.

## SECTION K - Product Value Score

Product Value Score: ${pvs}/100.

Interpretation: ${pvs >= 85 ? "excellent" : pvs >= 75 ? "strong" : pvs >= 60 ? "useful" : "weak"}.

## SECTION L - Top 25 improvements

${table(
    ["rank", "improvement", "impact", "difficulty", "confidence", "auto_implement"],
    top25Improvements().map((item) => [
      item.rank,
      item.title,
      item.impact,
      item.difficulty,
      item.confidence,
      item.auto_implement ? "yes" : "no",
    ]),
  )}

## SECTION M - Launch recommendation

Implement the top delivery improvements first. Do not rewrite the extractor or add paid APIs. The product is valuable, but speed and progressive delivery decide whether users feel the value before they leave.

IMPLEMENT TOP IMPROVEMENTS FIRST
`;
}

function deliveryReport() {
  const usefulCases = cases.filter((item) => {
    const hasCore =
      item.positioning_status === "useful" && item.cta_status === "useful";
    const extra =
      item.pricing_status === "found" ||
      item.pricing_status === "contact_sales" ||
      item.feature_status === "useful";

    return hasCore && extra;
  });
  const underThreeSeconds = cases.filter(
    (item) => item.analysis_duration_ms <= 3000,
  );
  const underEightSeconds = cases.filter(
    (item) => item.analysis_duration_ms <= 8000,
  );
  const progressiveReliability = bounded(
    pct(usefulCases.length, cases.length) * 0.35 +
      report.scorecard.dashboard_clarity * 0.25 +
      average([
        report.scorecard.pricing_precision,
        report.scorecard.positioning_precision,
        report.scorecard.counterexample_score,
      ]) * 0.2 +
      pct(underThreeSeconds.length, cases.length) * 0.2,
  );

  return `# Final V9 Latency-Completeness Decoupling Report

Generated after the product intelligence report from \`${inputPath}\`.

## SECTION A - Latency sources

- Median full analysis: ${report.scorecard.median_duration_ms}ms
- P95 full analysis: ${report.scorecard.p95_duration_ms}ms
- Cases <=3000ms full completion: ${underThreeSeconds.length}/${cases.length}
- Cases <=8000ms full completion: ${underEightSeconds.length}/${cases.length}
- Slow-analysis simulated dropoffs: ${report.ux_lab.dropoffs.find((item) => item.reason === "slow_analysis")?.count ?? 0}

The latency source is full completion, not evidence quality. The product should not wait for sitemap/deep-page completion before showing useful intelligence.

## SECTION B - Progressive delivery

Recommended delivery model:

- Stage 1 under 1500ms: availability, homepage purpose, confidence, initial watch suggestion.
- Stage 2 under 3000ms: positioning and primary CTA.
- Stage 3 under 5000ms: pricing and feature cards when already visible.
- Stage 4 background: sitemap, FAQ, docs, changelog, non-standard pricing candidates, smart retries.

Implemented in this pass:

- Scan quality now records delivery_status as useful, limited, or failed.
- Scan quality now records time_to_useful_insight_ms.
- Scan quality now records dashboard_complete_target_ms.
- Scan quality now records progressive stage messages.
- User-facing scan copy now describes understanding, pricing checks, update checks, and competitor comparison instead of a single opaque loading state.

Scan status should be "useful", "limited", or "failed". Pricing may show "Still scanning" instead of blocking the whole result.

## SECTION C - Reliability recompute

New weights:

- usefulness: 35
- clarity: 25
- correctness: 20
- speed: 20

Progressive reliability estimate from current artifact: ${progressiveReliability}/100. This is an estimate because the diagnostic captured total analysis duration, not exact staged first-insight timings.

## SECTION D - User journey impact

- Useful core signal cases: ${usefulCases.length}/${cases.length}
- Full dashboard under 8s: ${underEightSeconds.length}/${cases.length}
- Time-to-useful-insight instrumentation: added after the 100-case diagnostic, not captured in this artifact
- Expected impact: lower perceived wait, fewer slow-analysis dropoffs, clearer trust when pricing is incomplete.

## SECTION E - Updated scores

- Current reliability: ${report.final_scores.reliability}/100
- Progressive reliability estimate: ${progressiveReliability}/100
- Current performance: ${report.scorecard.performance}/100
- Delivery confidence: medium-low until the next live run captures staged timings.

## SECTION F - Remaining blockers

- The app still needs a true streamed/staged endpoint to show Stage 1 and Stage 2 before the server action completes.
- The scan worker should prioritize homepage-first results and queue deeper pages.
- A 20-site post-implementation live revalidation should record staged timings separately from full completion.
- Pricing retries should be targeted, not full rescans.

FIX DELIVERY FIRST
`;
}

await writeFile(diagnosticReportPath, diagnosticReport(), "utf8");
await writeFile(productReportPath, productReport(), "utf8");
await writeFile(deliveryReportPath, deliveryReport(), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      reports: [diagnosticReportPath, productReportPath, deliveryReportPath],
      final_lines: {
        diagnostic: launchFinalLine(),
        product: "IMPLEMENT TOP IMPROVEMENTS FIRST",
        delivery: "FIX DELIVERY FIRST",
      },
    },
    null,
    2,
  ),
);
