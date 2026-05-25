# Final V14 Core Analyzer Report

SECTION A - Analyzer contract
- Failed before: extractors could run before page type verification.
- Changed: PageIntelligence now carries page_validation, detected_page_type, page_type_verified, valid_for_intelligence, and intelligence_status.
- Test/evidence: duplicate homepage fixture returns duplicate_homepage and zero facts.
- Pass/fail: PASS

SECTION B - Page-type validation
- Failed before: /pricing could silently analyze a homepage response.
- Changed: requested/final URL, normalized URL, detected type, confidence, hash, duplicate-homepage status, and extraction_allowed are computed before extraction.
- Test/evidence: Lovable duplicate homepage fixture suppresses pricing extraction.
- Pass/fail: PASS

SECTION C - URL normalization
- Changed: analyzer canonicalization strips utm_*, gclid, fbclid, msclkid, hashes, duplicate slashes, and trailing slashes while preserving meaningful params.
- Test/evidence: example.com/pricing?utm_campaign=x normalizes to https://example.com/pricing.
- Pass/fail: PASS

SECTION D - Pricing extraction
- Changed: user-facing price candidates require >=0.80 confidence; 0.60-0.80 stays unclear; lower scores are rejected.
- Changed: candidate debug records ancestor path and 300-character before/after context.
- Test/evidence: PropAI accepts Free and Plus EUR 5 while rejecting budgets and generated examples.
- Pass/fail: PASS

SECTION E - PropAI golden fixture
- Expected accepted signals: Free, 50 proposals/week, Sign up free, Plus, EUR 5/month, 100 proposals/week, Get Plus.
- Expected rejected signals: $2,500, $800/mo, $80-120/article, USD 2.5, USD 80.
- Test/evidence: permanent tests/fixtures/analyzer/propai-*.html.
- Pass/fail: PASS

SECTION F - Plausible/Fathom fixtures
- Expected Plausible: Starter EUR 9, Growth EUR 14, Business EUR 19, Enterprise custom/contact, monthly/yearly.
- Expected Fathom: USD usage tiers from $15 through $470 and contact above 25M pageviews.
- Test/evidence: permanent Plausible and Fathom fixtures pass.
- Pass/fail: PASS

SECTION G - Feature extraction
- Changed: PropAI features are semantic product capabilities, not CTA/testimonial/proof noise.
- Test/evidence: voice-matched generation, writing sample analysis/fast proposal creation, and personalization are detected.
- Pass/fail: PASS

SECTION H - Positioning extraction
- Changed: positioning rejects sample/generated/budget/job lines.
- Test/evidence: PropAI headline stays exactly 'The freelance proposal generator that writes in your voice'.
- Pass/fail: PASS

SECTION I - CTA extraction
- Changed: CTA output remains limited to product CTAs from verified pages.
- Test/evidence: PropAI homepage produces a non-unknown product CTA and rejects utility/footer examples.
- Pass/fail: PASS

SECTION J - Snapshot validity
- Changed: snapshots persist page_validation and valid_for_intelligence inside structured facts/analyzed page payloads.
- Test/evidence: invalid duplicate pages produce intelligence_status invalid_for_intelligence and no facts.
- Pass/fail: PASS

SECTION K - Change detection
- Changed: alerts require both previous and current snapshots to be verified for the requested page type.
- Test/evidence: verified PropAI price change creates a pricing payload; duplicate homepage creates no alert.
- Pass/fail: PASS

SECTION L - Recommendations
- Changed: user-product recommendations use only valid page facts; latest competitor snapshots without valid analyzed_pages metadata are ignored.
- Test/evidence: code path now filters product facts by validForIntelligence before recommendation generation.
- Pass/fail: PASS

SECTION M - Debug traceability
- Changed: scan debug pages include detected_page_type, page_type_verified, valid_for_intelligence, intelligence_status, and full page_validation.
- Test/evidence: compact debug payload is sourced from PageIntelligence validation fields.
- Pass/fail: PASS

SECTION N - Production/quarantine status
- Local code now fails closed for old snapshots that lack page-validation metadata.
- Production read check: 1 existing intelligence snapshot has 0 V14-valid analyzed pages, so the new UI path hides it as limited data until verified rescan.
- Production read check: 12 detected_changes exist; 10 are below the new 0.72 alert floor and are filtered from dashboard/detail views.
- Production read check: 39 legacy snapshots exist; 0 have V14 validation metadata, so future change detection suppresses alerts until a new verified baseline exists.
- Pass/fail: PASS

SECTION O - Verdict
- Automated V14 fixture suite passed, legacy production intelligence is quarantined without deletion, and future alerts require verified page-type metadata.

CORE ANALYZER TRUSTWORTHY
