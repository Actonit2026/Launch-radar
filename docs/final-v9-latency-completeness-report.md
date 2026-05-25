# Final V9 Latency-Completeness Decoupling Report

Generated after the product intelligence report from `docs/final-v9-diagnostic-output.json`.

## SECTION A - Latency sources

- Median full analysis: 6313ms
- P95 full analysis: 11486ms
- Cases <=3000ms full completion: 8/100
- Cases <=8000ms full completion: 76/100
- Slow-analysis simulated dropoffs: 24

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

Progressive reliability estimate from current artifact: 79/100. This is an estimate because the diagnostic captured total analysis duration, not exact staged first-insight timings.

## SECTION D - User journey impact

- Useful core signal cases: 92/100
- Full dashboard under 8s: 76/100
- Time-to-useful-insight instrumentation: added after the 100-case diagnostic, not captured in this artifact
- Expected impact: lower perceived wait, fewer slow-analysis dropoffs, clearer trust when pricing is incomplete.

## SECTION E - Updated scores

- Current reliability: 91/100
- Progressive reliability estimate: 79/100
- Current performance: 76/100
- Delivery confidence: medium-low until the next live run captures staged timings.

## SECTION F - Remaining blockers

- The app still needs a true streamed/staged endpoint to show Stage 1 and Stage 2 before the server action completes.
- The scan worker should prioritize homepage-first results and queue deeper pages.
- A 20-site post-implementation live revalidation should record staged timings separately from full completion.
- Pricing retries should be targeted, not full rescans.

FIX DELIVERY FIRST
