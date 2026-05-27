# Final V15 Product Path Trust Report

## SECTION A - Overfitting audit
- Files changed: analyzer-v3 persistence/display contract, scanner wiring, dashboard data loading.
- Tests run: static production-source audit.
- Evidence: 0 forbidden domain/company hits in production analyzer/display path.
- Pass/fail: PASS.
- Remaining risk: Fixture files still contain known examples by design.

## SECTION B - User-facing data source audit
- Files changed: src/lib/competitors.ts, src/lib/user-products.ts.
- Tests run: source assertions.
- Evidence: normal competitor UI reads v3_intelligence_snapshots and active v3 detected_changes only.
- Pass/fail: PASS.
- Remaining risk: legacy snapshot writer remains for migration compatibility, but not as normal competitor UI source.

## SECTION C - V3 storage
- Files changed: supabase/migrations/0024_v3_product_path_trust.sql, supabase/migrations/0025_v3_product_path_fk_indexes.sql, src/lib/database.types.ts, src/lib/analyzer-v3/persistence.ts.
- Tests run: migration source assertions and Supabase production table check.
- Evidence: v3_intelligence_snapshots and v3_shadow_output exist in production with RLS; both currently have 0 rows.
- Pass/fail: PASS.
- Remaining risk: production still needs V3 shadow/manual scan rows before default promotion.

## SECTION D - Scheduled scan repair
- Files changed: src/app/api/scheduled-scans/route.ts, src/lib/usage.ts, src/lib/scanner.ts.
- Tests run: source assertions.
- Evidence: scheduled route iterates active competitor owners from competitors instead of users.
- Pass/fail: PASS.
- Remaining risk: plan lookups still prefer public.users when present and safely default only on missing-table errors.

## SECTION E - V3 scan path wiring
- Files changed: src/lib/scanner.ts.
- Tests run: type/build validation required after this script.
- Evidence: initial setup, manual analysis, and manual/scheduled scan paths call V3 when enabled or shadowed.
- Pass/fail: PASS.
- Remaining risk: admin/example refresh remains outside the normal competitor product path.

## SECTION F - Pricing display contract
- Files changed: src/lib/analyzer-v3/pricing-display.ts, src/lib/intelligence/display.ts.
- Tests run: 54 generalized pricing display cases.
- Evidence: display options are built only from accepted V3 plans, usage tiers, and contact-sales state.
- Pass/fail: PASS.
- Remaining risk: UX may need copy tuning for rare partial pricing states.

## SECTION G - Accepted/displayed invariant
- Files changed: src/lib/analyzer-v3/pricing-display.ts.
- Tests run: explicit over-render failure test.
- Evidence: injected legacy fallback row blocked and rendered as pricing_unclear.
- Pass/fail: PASS.
- Remaining risk: Browser-visible DOM count should be included in the live 30-site promotion test.

## SECTION H - Dedupe logic
- Files changed: src/lib/analyzer-v3/pricing-display.ts.
- Tests run: randomized duplicate mobile/desktop/source cases.
- Evidence: duplicate stable pricing keys merge evidence and render once.
- Pass/fail: PASS.
- Remaining risk: source_block_id quality depends on upstream segmentation.

## SECTION I - 50 randomized UI display tests
- Files changed: scripts/final-v15-product-path.mjs.
- Tests run: 54 randomized/fixed cases.
- Evidence: displayed <= accepted and displayed subset accepted for every case.
- Pass/fail: PASS.
- Remaining risk: randomized tests are model-level, not browser DOM screenshots.

## SECTION J - 30 live website product-path tests
- Files changed: none.
- Tests run: not run.
- Evidence: The automated npm test enforces generalized invariants without mutating live customer data. Live 30-site product-path validation remains a promotion gate.
- Pass/fail: FAIL.
- Remaining risk: This blocks default promotion.

## SECTION K - Known smoke tests
- Files changed: none.
- Tests run: covered by existing test:v14/test:v15 analyzer scripts, not success-defining here.
- Evidence: known examples are not referenced in production V3 display contract.
- Pass/fail: PASS.
- Remaining risk: run the existing smoke scripts before release promotion.

## SECTION L - Legacy pricing removal
- Files changed: src/lib/competitors.ts, src/lib/user-products.ts.
- Tests run: source assertions.
- Evidence: normal competitor UI no longer reads competitor_intelligence_snapshots.
- Pass/fail: PASS.
- Remaining risk: legacy code remains for historical/admin/debug compatibility.

## SECTION M - Model-based change detection
- Files changed: src/lib/analyzer-v3/persistence.ts, src/lib/scanner.ts, supabase/migrations/0024_v3_product_path_trust.sql.
- Tests run: migration/source assertions.
- Evidence: V3 changes carry analyzer_version, change_model_type, source_snapshot_id, status, and evidence.
- Pass/fail: PASS.
- Remaining risk: live model-diff validation is still needed.

## SECTION N - Legacy quarantine
- Files changed: supabase/migrations/0024_v3_product_path_trust.sql.
- Tests run: migration source assertions and Supabase production count check.
- Evidence: production now has 6 legacy_quarantined changes, 0 active legacy visible changes, and 0 active V3 changes.
- Pass/fail: PASS.
- Remaining risk: future V3 changes need live model-diff validation.

## SECTION O - Shadow mode storage
- Files changed: src/lib/analyzer-v3/persistence.ts, src/lib/scanner.ts.
- Tests run: source/type validation and Supabase production count check.
- Evidence: shadow rows include accepted/rejected/displayed price counts and dangerous_output; production currently has 0 shadow rows.
- Pass/fail: PARTIAL.
- Remaining risk: requires ANALYZER_V3_SHADOW_MODE=true and at least one manual/scheduled scan in production to prove rows.

## SECTION P - JS/rendering reality
- Files changed: no production Chromium enablement.
- Tests run: existing Analyzer V3 JS-shell fixture should be run with test:v15:analyzer-v3.
- Evidence: rendering remains opt-in via ANALYZER_V3_RENDER_ENABLED; static JS shells safe-fail.
- Pass/fail: PASS.
- Remaining risk: external worker architecture is still separate.

## SECTION Q - Standard test runner
- Files changed: package.json, scripts/final-v15-product-path.mjs.
- Tests run: npm test target added.
- Evidence: npm test fails on pricing display invariant, legacy data source, storage, and scheduled-route regressions.
- Pass/fail: PASS.
- Remaining risk: This is equivalent Node assertion coverage, not Vitest.

## SECTION R - Promotion decision
- Files changed: none.
- Tests run: promotion gate evaluation.
- Evidence: 30 live website product-path tests and production shadow-row proof are not complete.
- Pass/fail: FAIL.
- Remaining risk: Keep V3 in shadow mode until live validation passes.

## SECTION S - Remaining blockers
- Enable ANALYZER_V3_SHADOW_MODE and run one manual plus one scheduled scan to prove v3_shadow_output rows.
- Run 30 non-fixture SaaS product-path validations through the same UI/API path.
- Promote ENABLE_ANALYZER_V3 only after zero dangerous outputs.

V3 GENERAL PRODUCT PATH STILL BROKEN
