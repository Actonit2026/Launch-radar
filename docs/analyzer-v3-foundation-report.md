# Analyzer V3 Foundation Report

SECTION A - Analyzer V3 architecture
- Implementation: Added src/lib/analyzer-v3 as an independently callable deterministic-first module.
- Test performed: Analyzer V3 fixture harness compiles and calls the public V3 contract.
- Evidence: 14/14 fixture checks passed.
- Pass/fail: PASS
- Remaining risk: Production switch should remain feature-flagged until shadow runs are reviewed.

SECTION B - URL safety and canonicalization
- Implementation: HTTPS-only normalization, tracking parameter stripping, public-host validation, and safe URL construction.
- Test performed: Lovable UTM fixture and unsafe http/localhost rejection.
- Evidence: canonical Lovable URL is https://lovable.dev and /pricing is built from origin, not query text.
- Pass/fail: PASS
- Remaining risk: Live DNS rebinding protection depends on runtime DNS resolution during fetch.

SECTION C - Page bundle fetch/render
- Implementation: PageBundle with homepage, pricing candidates, optional pages, blocked/missing/duplicate lists, and render-required flag.
- Test performed: fixture page bundles for homepage, pricing, missing, blocked, duplicate, and JS shell pages.
- Evidence: missing pricing and blocked fixtures are marked missing/blocked without fabricating models.
- Pass/fail: PASS
- Remaining risk: Browser rendering is intentionally gated by ANALYZER_V3_RENDER_ENABLED.

SECTION D - Page type classification
- Implementation: Classifier combines URL, title/text, block roles, and duplicate-homepage detection.
- Test performed: pricing, homepage, duplicate pricing homepage, blocked, and missing fixtures.
- Evidence: Lovable /pricing duplicate is invalid_for page-specific extraction.
- Pass/fail: PASS
- Remaining risk: More live edge cases should be added as permanent fixtures.

SECTION E - DOM segmentation
- Implementation: EvidenceBlock segmentation captures DOM path, headings, visibility, sibling grouping, tables, lists, links, buttons, and local signals.
- Test performed: pricing card/table, feature, testimonial, case study, and shell fixtures.
- Evidence: models are built from blocks rather than flattened full-page text.
- Pass/fail: PASS
- Remaining risk: Visual viewport order is estimated from DOM order in V1.

SECTION F - Block role classification
- Implementation: Every block receives a role before extraction; negative context beats weak price signals.
- Test performed: testimonial and case-study budget fixtures.
- Evidence: budget/testimonial prices are rejected and never become pricing plans.
- Pass/fail: PASS
- Remaining risk: Rich component libraries may need additional class/id role signals.

SECTION G - Entity extraction
- Implementation: Money, billing period, plan, limit, CTA, headline, feature, and release-date entities carry source block, evidence, confidence, accepted/rejected state.
- Test performed: PropAI, Plausible, Fathom, pricing table/cards, negative fixtures.
- Evidence: precision 1, recall 0.986.
- Pass/fail: PASS
- Remaining risk: Recall is allowed to be partial when precision remains high.

SECTION H - Pricing model
- Implementation: PricingModelV3 supports public pricing, contact sales, unclear, no public pricing, plans, usage tiers, rejected candidates, evidence, confidence, completeness.
- Test performed: PropAI, Plausible, Fathom, pricing table, pricing cards, contaminated prices.
- Evidence: no fake Plan 1/2 names, no Free EUR 5, no project budgets surfaced.
- Pass/fail: PASS
- Remaining risk: Enterprise/contact options should get a dedicated UI field before broad rollout.

SECTION I - Homepage/positioning model
- Implementation: Homepage model uses hero headline/subheadline evidence and rejects contaminated examples.
- Test performed: PropAI homepage fixture.
- Evidence: headline remains exactly 'The freelance proposal generator that writes in your voice'.
- Pass/fail: PASS
- Remaining risk: Category inference remains deliberately conservative.

SECTION J - CTA model
- Implementation: CTA entities prioritize hero/pricing/product CTAs and reject login/docs/legal utility links.
- Test performed: PropAI and pricing card fixtures.
- Evidence: product CTA has non-unknown intent.
- Pass/fail: PASS
- Remaining risk: Some designs use icon-only buttons that require aria-label quality.

SECTION K - Feature/changelog models
- Implementation: Feature/changelog models only consume verified feature/update blocks.
- Test performed: PropAI features and generic no-changelog cases.
- Evidence: feature model reaches at least three PropAI capability signals.
- Pass/fail: PASS
- Remaining risk: Changelog extraction is available but not optimized for all blog/update hybrids.

SECTION L - Snapshot validation
- Implementation: Validation rejects missing evidence, blocked/missing homepage, fake plan names, and impossible Free paid plans.
- Test performed: blocked, missing, JS shell, duplicate page fixtures.
- Evidence: invalid pages never become verified snapshots.
- Pass/fail: PASS
- Remaining risk: Existing production rows still need quarantine once V3 is enabled.

SECTION M - BusinessModel assembly
- Implementation: BusinessModelV3 is the single downstream object containing availability, homepage, positioning, CTA, pricing, features, changelog, confidence, completeness, evidence, missing data.
- Test performed: all fixture checks consume BusinessModelV3 instead of raw text.
- Evidence: compare harness uses business_model only.
- Pass/fail: PASS
- Remaining risk: Old app code still consumes V14 models until flag rollout.

SECTION N - Model-based change detection
- Implementation: V3 comparison compares typed business models, not raw percent text deltas.
- Test performed: pricing card $29 to $39 fixture.
- Evidence: output names pricing_model_changed and never mentions percent text changed.
- Pass/fail: PASS
- Remaining risk: Production scanner is not yet switched to V3 comparisons by default.

SECTION O - Recommendation prerequisites
- Implementation: V3 exposes accepted entities, rejected entities, validity, evidence, missing reasons, and model confidence for downstream recommendations.
- Test performed: negative fixtures return no pricing recommendation-ready facts.
- Evidence: no valid model means downstream can return a precise no-recommendation reason.
- Pass/fail: PASS
- Remaining risk: Recommendation code still needs a later V3 consumer migration.

SECTION P - Golden fixture results
- Implementation: 14 permanent fixture checks cover PropAI, Plausible, Fathom, Lovable UTM, duplicate homepage, testimonial prices, case study budgets, pricing table/cards, JS shell, blocked, missing, and model diff.
- Test performed: npm run test:v15:analyzer-v3.
- Evidence: {"passed":14,"failed":0,"precision":1,"recall":0.986}.
- Pass/fail: PASS
- Remaining risk: Add more real SaaS pages to increase recall safely.

SECTION Q - Evaluation harness results
- Implementation: scripts/analyzer-v3-evaluation.mjs compiles V3 in isolation and emits JSON + markdown reports.
- Test performed: safe-url-foundation:pass, propai-pricing:pass, propai-positioning-cta-features:pass, plausible-pricing:pass, fathom-pricing:pass, lovable-utm-duplicate-homepage:pass, testimonial-price-rejection:pass, case-study-budget-rejection:pass, pricing-table:pass, pricing-cards:pass, js-shell-page:pass, blocked-page:pass, missing-pricing-page:pass, model-based-change-detection:pass.
- Evidence: docs/analyzer-v3-evaluation-output.json.
- Pass/fail: PASS
- Remaining risk: Harness is deterministic fixtures only, not live network.

SECTION R - Shadow mode results
- Implementation: ENABLE_ANALYZER_V3 and ANALYZER_V3_SHADOW_MODE helpers are exposed; initial setup and manual analysis can attach V3 shadow output to scan_debug_logs without changing production scan outcomes.
- Test performed: fixture shadow comparison through old-safe independent V3 calls plus full project typecheck/build.
- Evidence: analyzer_v3_shadow is included in scan debug payloads only when ANALYZER_V3_SHADOW_MODE=true.
- Pass/fail: PASS
- Remaining risk: Production shadow mode should be enabled only after environment review.

SECTION S - Bad data quarantine
- Implementation: V3 rejects contaminated prices and invalid snapshots by construction; existing V14 display/alert gates continue to hide invalid analyzed pages and low-confidence changes.
- Test performed: contaminated PropAI/testimonial/case-study fixtures and read-only Supabase production checks.
- Evidence: rejected_entities contain budget/sample contexts while user-facing pricing remains clean; production still has 10 low-confidence legacy detected_changes and 1 tracking-param monitored page, so data should be backed up before any mutation quarantine.
- Pass/fail: PASS
- Remaining risk: Historical rows remain in storage; current code-level quarantine prevents them from powering trusted output, but physical quarantine should be a separate backed-up operation.

SECTION T - Production verification
- Implementation: Read-only production checks were run through Supabase MCP against project mxieyhfixqxwhlvtkrzc.
- Test performed: checked monitored_pages, snapshots, detected_changes, and latest competitor_intelligence_snapshots.
- Evidence: 20 monitored_pages; 1 malformed/tracking monitored page (Notion /product/dev with utm params); 42 snapshots; 0 null structured_facts_json; 0 valid snapshots without facts; 0 low-confidence lowest-price snapshots; 12 detected_changes; 10 low-confidence legacy changes; 0 UTM changes; 0 raw/percent-diff changes. Recent production competitors currently do not have V3-valid analyzed_pages yet because V3 is feature-flagged.
- Pass/fail: PARTIAL
- Remaining risk: V3 is not the default production analyzer yet; production still needs a shadow-mode run, backup, then explicit quarantine of legacy low-confidence changes and malformed monitored page URLs.

SECTION U - Remaining blockers
- Production rollout remains feature-flagged; shadow persistence and quarantine migration are the next operational steps.

ANALYZER V3 FOUNDATION TRUSTWORTHY
