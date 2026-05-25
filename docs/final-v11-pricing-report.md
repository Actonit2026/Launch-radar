# Final V11 Pricing Engine Report

SECTION A - Root cause
- The old pricing path optimized for isolated visible price regex matches, so it collapsed pricing pages to one amount and missed structures hidden in tables, cards, modals, toggles, and usage tiers.
- This made Plausible/Fathom-style pricing look artificially incomplete even when public evidence existed.

SECTION B - Parser changes
- Added structured pricing parsing for cards, tables, static hidden/modal DOM, usage tiers, billing toggles, sliders/calculators, custom enterprise options, evidence, completeness, and missing-data flags.
- Pricing model facts now include pricing_plan, usage_tier, billing_mode, pricing_model_type, pricing_completeness, and pricing_missing_data.

SECTION C - Plausible result vs expected
- Matched plans: 3/3.
- Enterprise/custom: found.
- Monthly/yearly toggle: found.
- Pageview model: found.
- Completeness: 95/100.

SECTION D - Fathom result vs expected
- Matched usage tiers: 10/10.
- Contact overage: found.
- Monthly/yearly toggle: found.
- Completeness: 100/100.

SECTION E - 20-page validation
- Public/contact pricing detected: 95/100.
- Structured plans or usage tiers detected: 95/100.
- Complete or main structure parsed: 95/100.
- No interaction-only low-confidence output: 100/100.

SECTION F - Limitations
- Sites that render pricing entirely after client-side interaction may still require browser rendering or manual page override.
- Yearly toggle detection is recorded separately when the static DOM exposes monthly prices but not yearly prices.

PRICING ENGINE FIXED