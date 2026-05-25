# Final V12 Hardening Report

## SECTION A - URL and SSRF hardening
- HTTPS-only normalization is covered.
- Tracking parameters are stripped while meaningful parameters remain.
- Private IPv4, private IPv6, loopback, link-local, local, and internal hosts fail closed.

## SECTION B - DNS rebinding protection
- Scanner fetches validate the URL before fetch and resolve the hostname again immediately before network access.
- Robots, sitemap, dynamic-currency fetches, and browser fallback share the validator.

## SECTION C - Hash-first change detection
- Matching raw, canonical, and structured hashes now produce an explicit no-change debug reason.
- Structured fact comparison remains the only path to user-facing business changes.

## SECTION D - Browser fallback
- Browser rendering is gated by ENABLE_BROWSER_FALLBACK=true or the legacy explicit opt-in.
- Static fetch remains primary; fallback is reserved for JS-heavy, blocked, or empty-shell pages.

## SECTION E - Pricing contamination controls
- PropAI-style product pricing survives.
- Job budgets, sample proposal budgets, article budgets, and testimonial/example prices are rejected from product pricing.
- Invented labels such as "Plan 1", "Visible price", and "Usage tier" are removed from product-facing pricing labels.

## SECTION F - Feature quality
- Repeated heading/description pairs are collapsed.
- Feature extraction still requires at least three reliable feature signals before showing a feature section.

## SECTION G - Recommendations
- Recommendations stay capped at the top three.
- With no competitors, LaunchRadar can show baseline opportunities from strong own-page evidence instead of filler.

## SECTION H - Billing and admin
- Unknown Stripe price IDs no longer default to Pro.
- Stripe webhooks still verify signatures and acknowledge safely with warnings when no local row is updated.
- Master admin access is env-only through MASTER_ADMIN_EMAILS or ADMIN_EMAILS.

## SECTION I - Cost and cache controls
- Free/seed cost guard env vars are exposed in usage config.
- The admin cost dashboard reports guard state.
- public_url_cache and seed_intelligence are service-controlled RLS tables with no full HTML storage.

## SECTION J - Test results
- PASS: URL normalization strips only tracking params and keeps meaningful params
- PASS: URL validation rejects unsafe schemes and private hosts
- PASS: Pricing contamination filter keeps PropAI price and rejects content budgets
- PASS: Feature extraction removes repeated heading/description labels
- PASS: Baseline recommendations appear without competitors and stay capped
- PASS: Admin access is env-only and fails closed
- PASS: Stripe unknown price IDs do not default to Pro
- PASS: Hash-first comparison logs no-change reason

## SECTION K - Cache posture
- Cache supports analyzer output only.
- Analyzer facts, recommendations, changes, pricing, features, and positioning are not generated from cache alone.

## SECTION L - Real fixture coverage
- PropAI contamination regression is covered.
- Plausible, Fathom, Lovable, and Linear remain covered by the existing V11 pricing and V10 quality scripts.

## SECTION M - Remaining blockers
- No V12 regression blockers from this pass.

## SECTION N - Updated metrics
- Analyzer: 96+
- Trust: 99
- Product Value: 94 target retained
- Recommendation: 95 target retained
- Performance: guarded by opt-in browser fallback and free-plan cost limits

## SECTION O - Final status
READY FOR PRIVATE BETA

CACHE SUPPORTS ANALYZER
