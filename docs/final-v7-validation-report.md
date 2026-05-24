# Final V7 Pre-Launch Validation Report

Date: 2026-05-24
Commit: f736af6
Production: https://launch-radar-smoky.vercel.app

## Validation Summary

- 100 live SaaS scenarios tested.
- 100 unique URLs analyzed.
- AI disabled.
- OpenAI calls: 0.
- Counterexamples passed: 4/4.
- V7 launch decision: NOT READY.

## Scorecard

| Area | Score |
| --- | ---: |
| Reliability | 94 |
| UX | 94 |
| Trust | 99 |
| Analyzer | 97 |
| Recommendation Quality | 100 |
| Cost Efficiency | 100 |
| Readiness | 97 |

## Failed Gate

Reliability failed the required V7 gate of 97. The measured score was 94.

Primary cause:

- 16/100 simulated journeys still dropped due to slow analysis.
- 8/100 scenarios produced weak or incomplete intelligence.

## Auto-Applied Improvements

1. Added repeatable V7 100-scenario prelaunch suite.
2. Ran sitemap discovery in parallel with homepage seed fetch.
3. Reduced sitemap timeout from 8s to 3s.
4. Parallelized nested sitemap fetches.
5. Reserved initial crawl slots for strategic page types: pricing, features, product, changelog, docs.
6. Suppressed the lower-quality bottom slice when multiple recommendations are generated.
7. Added softer feature-noise rejection for testimonial, review, and CTA-like text.

## Top 50 Improvement Backlog

| Rank | Improvement | Impact | Difficulty | Confidence | Auto |
| ---: | --- | --- | --- | --- | --- |
| 1 | Add per-scan time budget with graceful partial results before 10s. | High | Medium | High | No |
| 2 | Add per-domain retry/backoff for slow or blocking sites. | High | Medium | Medium | No |
| 3 | Surface partial-scan quality in the dashboard instead of treating slow pages as equal to complete scans. | High | Low | High | No |
| 4 | Add manual pricing URL prompt when pricing is expected but unclear. | High | Low | High | No |
| 5 | Improve pricing extraction for pages that expose pricing in calculators or usage tables. | High | Medium | Medium | No |
| 6 | Add structured blocked-site classification to distinguish protected sites from analyzer failures. | High | Low | High | No |
| 7 | Add allowlisted known pricing path candidates for common SaaS patterns such as `/pricing`, `/plans`, `/pricing-and-packaging`. | High | Low | Medium | No |
| 8 | Add confidence downgrade when a public price appears on a non-pricing page with weak billing context. | High | Medium | Medium | No |
| 9 | Improve feature extraction for large marketing pages with repeated testimonial blocks. | Medium | Low | High | Partial |
| 10 | Add a compact "scan quality" badge to baseline snapshots. | Medium | Low | High | No |
| 11 | Add reportable analysis duration per competitor scan. | Medium | Low | High | No |
| 12 | Add `scan_duration_ms` to debug logs and admin validation exports. | Medium | Low | High | No |
| 13 | Add route-level production smoke for authenticated dashboard with a seeded test account. | High | Medium | Medium | No |
| 14 | Add queue timeout telemetry for inline scanner versus worker mode. | Medium | Medium | Medium | No |
| 15 | Add crawler cache for repeated validation/admin runs to reduce duplicate public fetches. | Medium | Medium | High | No |
| 16 | Preserve failed candidate-page evidence in user-facing scan debug. | Medium | Low | High | No |
| 17 | Add manual "this is the pricing page" override directly from unclear pricing state. | High | Low | High | No |
| 18 | Add better pricing recall for JS-rendered app-shell pricing pages. | High | High | Medium | No |
| 19 | Add browser fallback only for admin validation, not normal free scans. | Medium | Medium | Medium | No |
| 20 | Add cost guard for browser fallback runtime. | High | Medium | High | No |
| 21 | Add exact source line snippets for pricing candidates in admin debug. | Medium | Low | High | No |
| 22 | Reject prices near analytics/tracking counts unless billing context is strong. | High | Low | High | Existing |
| 23 | Add stronger CTA precedence for hero buttons over feature-card links. | Medium | Low | Medium | No |
| 24 | Add positioning fallback from Open Graph title only when H1/hero are empty. | Medium | Low | Medium | No |
| 25 | Add "limited public data" onboarding copy for blocked sites. | Medium | Low | High | No |
| 26 | Add dashboard empty state for blocked competitor baseline. | Medium | Low | High | No |
| 27 | Add user-editable note for bad URL or inaccessible URL cases. | Medium | Low | Medium | No |
| 28 | Add validation category breakdown to `/admin/validation`. | Medium | Low | High | No |
| 29 | Add pass/fail trend chart for validation history. | Low | Low | Medium | No |
| 30 | Add "rerun slow cases" admin action. | Medium | Low | High | No |
| 31 | Add "rerun blocked cases with browser fallback" admin-only action. | Medium | Medium | Medium | No |
| 32 | Add public homepage example freshness threshold and hide stale cards automatically. | Medium | Low | High | Existing |
| 33 | Rotate homepage examples by category diversity, not only freshness. | Low | Low | Medium | No |
| 34 | Add exact homepage example analyzer score in admin only. | Low | Low | High | No |
| 35 | Add structured reason when recommendation is suppressed. | Medium | Low | Medium | No |
| 36 | Add recommendation suppression by novelty percentile across stored recommendations. | Medium | Medium | Medium | Partial |
| 37 | Add stronger feature category normalization. | Medium | Medium | Medium | No |
| 38 | Add "unknown by design" labels wherever evidence is insufficient. | High | Low | High | Existing |
| 39 | Add production cron smoke that records duration and status. | Medium | Medium | Medium | No |
| 40 | Add Supabase advisor check to release checklist. | Medium | Low | High | Existing |
| 41 | Add scan-worker health check that distinguishes inline mode from queued mode. | Medium | Low | High | Existing |
| 42 | Add authenticated admin route smoke through Playwright test user. | High | Medium | Medium | No |
| 43 | Add Vercel deployment log inspection to release checklist. | Medium | Low | Medium | No |
| 44 | Add crawler user-agent and robots outcomes to admin debug view. | Medium | Low | High | No |
| 45 | Add "confidence changed" change card type for model drift. | Low | Medium | Low | No |
| 46 | Add scan quality threshold before sending alerts. | High | Medium | High | No |
| 47 | Add email alert dry-run test to validation suite. | Medium | Medium | Medium | No |
| 48 | Add weekly digest dry-run test to validation suite. | Medium | Medium | Medium | No |
| 49 | Add public landing speed test budget to prelaunch suite. | Medium | Low | Medium | No |
| 50 | Add pricing ground-truth review workflow for the 100-scenario suite. | High | Medium | High | No |

