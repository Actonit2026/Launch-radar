# Final V8 Reliability Closing Pass

Date: 2026-05-25
Validation command: `npm run test:v7:prelaunch` via `test:v8:reliability` alias
AI: disabled
OpenAI calls: 0
Scenarios: 100 live SaaS URLs

## Section A - Speed Fixes

Implemented:

1. Added per-scan stage timing with budgets for fetch, discovery, extraction, scoring, and render-equivalent phases.
2. Added scan quality metadata with `complete`, `partial`, and `limited` states.
3. Made sitemap discovery opportunistic with a 1200 ms discovery budget instead of always blocking on sitemap completion.
4. Reduced sitemap fetch timeout from 3000 ms to 1800 ms.
5. Preserved normal fetch timeout at 6500 ms after testing a 3500 ms cutoff. The lower cutoff met p95 but caused too many useful pages to be marked unavailable.

Final measured speed:

| Metric | Result | Target |
| --- | ---: | ---: |
| Median analysis duration | 6083 ms | <4000 ms |
| p95 analysis duration | 12154 ms | <8000 ms |
| Sites under 8s | 68/100 | >=95/100 |

Speed remains the primary blocker.

## Section B - Completeness Fixes

Implemented:

1. Added more pricing fallback candidates: `/pricing-and-packaging`, `/pricing-plans`, and `/plans-and-pricing`.
2. Added `/faq` as a docs/help candidate.
3. Updated discovery to keep up to 3 pricing candidates and 2 candidates for other strategic types before generic pages.
4. Preserved failed and partial scan evidence in debug payloads through scan quality metadata.
5. Added explicit missing-category reporting for pricing, positioning, CTA, and features.

Validation result:

| Area | Result |
| --- | ---: |
| Pricing precision | 99 |
| Pricing recall | 93 |
| Positioning precision | 98 |
| CTA precision | 94 |
| Feature usefulness | 93 |
| Counterexamples | 4/4 |

Analyzer quality is acceptable for V8 precision, but recall/completeness still loses too many cases when public pages are slow or blocked.

## Section C - UX Fixes

Implemented:

1. Dashboard intelligence cards now show a scan quality badge: High quality, Medium quality, or Limited scan.
2. Partial and limited scans explain completed areas, skipped areas, and confidence impact.
3. Alerts are not sent from automatic scans when scan quality is below 80 or change confidence is below 0.72.
4. Homepage examples now hide stale examples, failed examples, and low-confidence examples.
5. Recommendation cards now expose usefulness scoring when available.

UX validation:

| Metric | Result | Target |
| --- | ---: | ---: |
| UX | 89 | >=95 |
| Attention clarity | 97 | >=90 |
| Decision friction index | 19 | <=20 |
| Time to first insight | 6s | <=45s |
| Behavioral pass | 93 | >=90 |

UX misses because slow and incomplete scans still create simulated dropoff.

## Section D - Recommendation Value Validation

Implemented:

1. Added recommendation value scoring on a 0-70 scale.
2. Scoring components: specificity, evidence, actionability, novelty, business impact, founder usefulness, and confidence.
3. Added adversarial review with supporting argument, counterargument, missing evidence, alternative explanation, and survive/fail flag.
4. Added implementability summary with expected change, impact, difficulty, and time estimate.
5. Suppressed recommendations below the show threshold. Recommendations must reach at least 55/70 and survive adversarial review.

Validation result:

| Metric | Result | Target |
| --- | ---: | ---: |
| Recommendation usefulness | 100 | >=90 |
| Recommendation acceptance proxy | 100 | >=85 |

Recommendation quality passes.

## Section E - Auto Improvements Applied

1. Added `src/lib/scan-quality.ts` for score, status, timing, alert eligibility, and confidence impact.
2. Persisted scan quality inside existing intelligence snapshot summary JSON.
3. Parsed and displayed scan quality in dashboard intelligence cards.
4. Added quality-aware alert suppression for automatic scans.
5. Added quality metadata to scan debug logs.
6. Added opportunistic sitemap timeout budget.
7. Added strategic pricing and FAQ fallback paths.
8. Hid stale or low-confidence homepage examples.
9. Added recommendation usefulness scoring and adversarial review.
10. Extended the live validation suite with V8 behavioral, attention, recommendation, and speed gates.

## Section F - Remaining Blockers

Final V8 scorecard:

| Area | Score | Gate |
| --- | ---: | --- |
| Reliability | 89 | Fail, target >=97 |
| UX | 89 | Fail, target >=95 |
| Trust | 99 | Pass |
| Analyzer | 95 | Pass |
| Recommendation quality | 100 | Pass |
| Recommendation acceptance | 100 | Pass |
| Attention clarity | 97 | Pass |
| Decision friction index | 19 | Pass |
| Time to first insight | 6s | Pass |
| Behavioral pass | 93 | Pass |
| Cost efficiency | 100 | Pass |
| Readiness | 96 | Informational |

Main blockers:

1. Performance: p95 remains 12154 ms against an 8000 ms target.
2. Reliability: 12/100 scenarios still fail the full strict journey.
3. Completeness: pricing recall is 93, and weak feature/CTA extraction remains visible in the long-tail cases.
4. Product tradeoff: a 3500 ms fetch cutoff improved p95 to 7557 ms but reduced analyzer quality too much, so it was rejected.

## Final Decision

NOT READY
