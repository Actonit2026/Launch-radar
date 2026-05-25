# Final V9 Diagnostic Report

Generated from `docs/final-v9-diagnostic-output.json`.

## SECTION A - Executive summary

- Live SaaS cases: 100
- AI enabled: false
- OpenAI/Anthropic calls: 0
- Pass / partial / fail: 88 / 11 / 1
- Reliability score: 91/100
- Analyzer score: 96/100
- Trust score: 99/100
- Performance score: 76/100
- Median duration: 6313ms
- P95 duration: 11486ms

Do not hide this: reliability, UX, and performance gates did not all pass. The product is accurate enough to keep improving, but the launch blocker is delivery speed and partial-result handling, not hallucination or AI cost.

## SECTION B - 100-case table

| case_number | name | url | category | status | analysis_duration_ms | pages_attempted | pages_successful | pages_failed | pricing_status | pricing_plans_detected | positioning_status | cta_status | feature_status | changelog_status | availability_status | evidence_status | user_value_score_0_to_10 | failure_reasons | current_limitations | recommended_fix | fix_difficulty | fix_priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Carrd | https://carrd.co | website builders | partial | 5158 | 6 | 1 | 5 | found | 2 | useful | weak | useful | not_detected | live | complete | 7.5 | no non-auth hero/link/button CTA survived ranking | CTA ranking may miss hero actions or reject passive but intentional CTAs<br>sitemap expansion is budgeted and may skip slow sitemap branches | Improve CTA precedence so hero and above-the-fold conversion links beat nav/footer/passive links. | low | high |
| 2 | Webflow | https://webflow.com | website builders | pass | 10954 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 3 | Framer | https://www.framer.com | website builders | pass | 9029 | 6 | 3 | 3 | found | 12 | useful | useful | useful | found | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 4 | Wix | https://www.wix.com | website builders | pass | 13756 | 6 | 1 | 5 | found | 2 | useful | useful | useful | not_detected | redirected | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 5 | Squarespace | https://www.squarespace.com | website builders | pass | 7421 | 6 | 3 | 3 | found | 2 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 6 | Typedream | https://typedream.com | website builders | pass | 5146 | 6 | 2 | 4 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 7 | Dorik | https://dorik.com | website builders | pass | 6174 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 8 | Softr | https://www.softr.io | website builders | pass | 6612 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 9 | Bubble | https://bubble.io | website builders | partial | 4950 | 6 | 3 | 3 | unclear | 0 | useful | weak | weak | not_detected | live | complete | 5 | pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules<br>no non-auth hero/link/button CTA survived ranking<br>only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals | pricing may require deeper discovery, interaction, or client-rendered content<br>CTA ranking may miss hero actions or reject passive but intentional CTAs<br>feature extraction needs clearer product sections and does not infer features from vague marketing copy<br>sitemap expansion is budgeted and may skip slow sitemap branches | Queue targeted pricing-only retries for pricing/plans/packages/FAQ candidates instead of rerunning full scans. | medium | high |
| 10 | Unicorn Platform | https://unicornplatform.com | website builders | pass | 3569 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 11 | Plausible | https://plausible.io | analytics | pass | 2891 | 6 | 1 | 5 | found | 2 | useful | useful | useful | not_detected | live | complete | 10 | - | - | No immediate fix; monitor for regressions. | low | low |
| 12 | Fathom | https://usefathom.com | analytics | pass | 2622 | 6 | 3 | 3 | found | 6 | useful | useful | useful | not_detected | live | complete | 10 | - | - | No immediate fix; monitor for regressions. | low | low |
| 13 | Simple Analytics | https://www.simpleanalytics.com | analytics | partial | 3066 | 6 | 2 | 4 | found | 10 | useful | weak | useful | not_detected | live | complete | 7.5 | no non-auth hero/link/button CTA survived ranking | CTA ranking may miss hero actions or reject passive but intentional CTAs<br>sitemap expansion is budgeted and may skip slow sitemap branches | Improve CTA precedence so hero and above-the-fold conversion links beat nav/footer/passive links. | low | high |
| 14 | PostHog | https://posthog.com | analytics | partial | 6727 | 6 | 3 | 3 | found | 1 | useful | useful | weak | not_detected | live | complete | 7.5 | only 1 reliable feature facts were extracted; target is at least 3 clear feature/product signals | feature extraction needs clearer product sections and does not infer features from vague marketing copy<br>sitemap expansion is budgeted and may skip slow sitemap branches | Tighten feature section detection and add table/card parsing without using testimonial/proof text. | medium | medium |
| 15 | Mixpanel | https://mixpanel.com | analytics | pass | 9430 | 6 | 3 | 3 | found | 2 | useful | useful | useful | not_detected | redirected | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 16 | Amplitude | https://amplitude.com | analytics | partial | 6869 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 8.5 | contact-sales fixture produced a visible-price classification, indicating pricing precision risk for enterprise pages | sitemap expansion is budgeted and may skip slow sitemap branches | No immediate fix; monitor for regressions. | low | low |
| 17 | Heap | https://heap.io | analytics | pass | 4932 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 18 | Matomo | https://matomo.org | analytics | pass | 5579 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 19 | Pirsch | https://pirsch.io | analytics | pass | 3653 | 6 | 3 | 3 | found | 3 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 20 | June | https://www.june.so | analytics | pass | 3003 | 6 | 2 | 4 | found | 1 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 21 | Better Stack | https://betterstack.com | monitoring | pass | 3949 | 6 | 2 | 4 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 22 | UptimeRobot | https://uptimerobot.com | monitoring | pass | 5130 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 23 | Sentry | https://sentry.io | monitoring | pass | 10744 | 6 | 2 | 4 | found | 2 | useful | useful | useful | not_detected | redirected | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 24 | Datadog | https://www.datadoghq.com | monitoring | pass | 7381 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 25 | New Relic | https://newrelic.com | monitoring | partial | 7383 | 6 | 2 | 4 | unclear | 0 | useful | useful | weak | not_detected | live | complete | 6 | pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules<br>only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals | pricing may require deeper discovery, interaction, or client-rendered content<br>feature extraction needs clearer product sections and does not infer features from vague marketing copy<br>sitemap expansion is budgeted and may skip slow sitemap branches | Queue targeted pricing-only retries for pricing/plans/packages/FAQ candidates instead of rerunning full scans. | medium | high |
| 26 | Cronitor | https://cronitor.io | monitoring | pass | 10264 | 6 | 1 | 5 | found | 12 | useful | useful | useful | not_detected | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 27 | Checkly | https://www.checklyhq.com | monitoring | pass | 6435 | 6 | 3 | 3 | found | 12 | useful | useful | useful | found | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 28 | Hyperping | https://hyperping.io | monitoring | pass | 9310 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | redirected | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 29 | Oh Dear | https://ohdear.app | monitoring | pass | 3969 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 30 | Statuspage | https://www.atlassian.com/software/statuspage | monitoring | pass | 7983 | 6 | 4 | 2 | found | 12 | useful | useful | useful | found | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 31 | Jasper | https://www.jasper.ai | AI tools | pass | 5502 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 32 | Copy.ai | https://www.copy.ai | AI tools | pass | 3415 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 33 | Runway | https://runwayml.com | AI tools | pass | 4553 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 34 | Perplexity | https://www.perplexity.ai | AI tools | fail | 4083 | 6 | 0 | 6 | failed | 0 | weak | weak | weak | not_detected | failed | none | 0.5 | all discovered candidate pages failed or returned no meaningful static text<br>pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules<br>positioning lacked a clear category, target customer, use case, or non-generic value proposition<br>no non-auth hero/link/button CTA survived ranking<br>only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals<br>baseline did not produce enough structured profile hashes or watchlist suggestions | static analyzer could not obtain useful public HTML from selected candidates<br>pricing may require deeper discovery, interaction, or client-rendered content<br>CTA ranking may miss hero actions or reject passive but intentional CTAs<br>feature extraction needs clearer product sections and does not infer features from vague marketing copy<br>positioning extraction rejects broad slogans without category or audience evidence | Add blocked/JS-heavy classification plus background browser fallback for admin-reviewed cases. | high | high |
| 35 | Cursor | https://cursor.com | AI tools | partial | 3680 | 6 | 2 | 4 | contact_sales | 1 | useful | useful | useful | not_detected | live | complete | 8.5 | pricing expected as visible, but extracted evidence only supported a contact-sales pricing path | sitemap expansion is budgeted and may skip slow sitemap branches | No immediate fix; monitor for regressions. | low | low |
| 36 | Fireflies | https://fireflies.ai | AI tools | pass | 7051 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 37 | Descript | https://www.descript.com | AI tools | pass | 9946 | 6 | 1 | 5 | found | 12 | useful | useful | useful | not_detected | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 38 | Grammarly | https://www.grammarly.com | AI tools | pass | 4163 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 39 | ElevenLabs | https://elevenlabs.io | AI tools | pass | 12023 | 6 | 2 | 4 | found | 12 | useful | useful | useful | not_detected | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 40 | Synthesia | https://www.synthesia.io | AI tools | pass | 5766 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 41 | Mailchimp | https://mailchimp.com | marketing | pass | 7088 | 6 | 3 | 3 | found | 9 | useful | useful | useful | found | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 42 | Kit | https://kit.com | marketing | pass | 4027 | 6 | 2 | 4 | found | 11 | useful | useful | useful | found | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 43 | Beehiiv | https://www.beehiiv.com | marketing | pass | 6413 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 44 | Buffer | https://buffer.com | marketing | pass | 5263 | 6 | 3 | 3 | found | 12 | useful | useful | useful | found | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 45 | Hootsuite | https://www.hootsuite.com | marketing | pass | 8040 | 6 | 3 | 3 | found | 5 | useful | useful | useful | found | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 46 | Later | https://later.com | marketing | pass | 5972 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 47 | ActiveCampaign | https://www.activecampaign.com | marketing | pass | 6002 | 6 | 3 | 3 | found | 3 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 48 | Brevo | https://www.brevo.com | marketing | pass | 8865 | 6 | 3 | 3 | found | 8 | useful | useful | useful | not_detected | redirected | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 49 | Loops | https://loops.so | marketing | partial | 7786 | 6 | 2 | 4 | contact_sales | 2 | useful | useful | useful | not_detected | live | complete | 8.5 | pricing expected as visible, but extracted evidence only supported a contact-sales pricing path | sitemap expansion is budgeted and may skip slow sitemap branches | No immediate fix; monitor for regressions. | low | low |
| 50 | Customer.io | https://customer.io | marketing | pass | 6532 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 51 | Supabase | https://supabase.com | developer tools | pass | 4739 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 52 | Vercel | https://vercel.com | developer tools | pass | 9369 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 53 | Netlify | https://www.netlify.com | developer tools | pass | 5572 | 6 | 3 | 3 | found | 12 | useful | useful | useful | found | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 54 | Railway | https://railway.com | developer tools | pass | 6277 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 55 | Render | https://render.com | developer tools | partial | 4571 | 6 | 3 | 3 | unclear | 0 | useful | weak | weak | not_detected | live | complete | 5 | pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules<br>no non-auth hero/link/button CTA survived ranking<br>only 1 reliable feature facts were extracted; target is at least 3 clear feature/product signals | pricing may require deeper discovery, interaction, or client-rendered content<br>CTA ranking may miss hero actions or reject passive but intentional CTAs<br>feature extraction needs clearer product sections and does not infer features from vague marketing copy<br>sitemap expansion is budgeted and may skip slow sitemap branches | Queue targeted pricing-only retries for pricing/plans/packages/FAQ candidates instead of rerunning full scans. | medium | high |
| 56 | Linear | https://linear.app | developer tools | pass | 14204 | 6 | 2 | 4 | found | 10 | useful | useful | useful | found | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 57 | GitHub | https://github.com | developer tools | pass | 5773 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 58 | GitLab | https://about.gitlab.com | developer tools | pass | 6600 | 6 | 3 | 3 | found | 12 | useful | useful | useful | found | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 59 | Snyk | https://snyk.io | developer tools | pass | 8209 | 6 | 3 | 3 | found | 9 | useful | useful | useful | not_detected | redirected | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 60 | Clerk | https://clerk.com | developer tools | pass | 7244 | 6 | 3 | 3 | found | 8 | useful | useful | useful | found | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 61 | Stripe | https://stripe.com | payments | pass | 8496 | 6 | 3 | 3 | found | 12 | useful | useful | useful | found | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 62 | Paddle | https://www.paddle.com | payments | pass | 10092 | 6 | 3 | 3 | found | 4 | useful | useful | useful | not_detected | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 63 | Lemon Squeezy | https://www.lemonsqueezy.com | payments | pass | 6321 | 6 | 3 | 3 | found | 4 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 64 | Chargebee | https://www.chargebee.com | payments | pass | 5894 | 6 | 3 | 3 | found | 1 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 65 | Recurly | https://recurly.com | payments | pass | 11930 | 6 | 3 | 3 | found | 3 | useful | useful | useful | not_detected | redirected | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 66 | Braintree | https://www.braintreepayments.com | payments | pass | 9931 | 6 | 3 | 3 | found | 5 | useful | useful | useful | not_detected | redirected | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 67 | Adyen | https://www.adyen.com | payments | pass | 7196 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 68 | Square | https://squareup.com | payments | pass | 11486 | 6 | 3 | 3 | found | 12 | useful | useful | useful | found | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 69 | PayPal | https://www.paypal.com/business | payments | pass | 7353 | 6 | 3 | 3 | found | 2 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 70 | RevenueCat | https://www.revenuecat.com | payments | pass | 9005 | 6 | 2 | 4 | found | 12 | useful | useful | useful | not_detected | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 71 | Salesforce | https://www.salesforce.com | CRM | pass | 8756 | 6 | 3 | 3 | contact_sales | 5 | useful | useful | useful | not_detected | redirected | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 72 | Pipedrive | https://www.pipedrive.com | CRM | pass | 4092 | 6 | 2 | 4 | found | 2 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 73 | Close | https://www.close.com | CRM | pass | 5323 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 74 | Attio | https://attio.com | CRM | pass | 13571 | 6 | 3 | 3 | found | 4 | useful | useful | useful | not_detected | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 75 | Folk | https://www.folk.app | CRM | pass | 3843 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 76 | Copper | https://www.copper.com | CRM | partial | 6696 | 6 | 3 | 3 | found | 12 | weak | useful | useful | not_detected | live | complete | 7 | positioning lacked a clear category, target customer, use case, or non-generic value proposition | positioning extraction rejects broad slogans without category or audience evidence<br>sitemap expansion is budgeted and may skip slow sitemap branches | Add a stricter homepage hero/category fallback using title, meta description, H1, and first paragraph only. | low | medium |
| 77 | Zoho CRM | https://www.zoho.com/crm | CRM | pass | 3994 | 6 | 4 | 2 | found | 3 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 78 | Monday CRM | https://monday.com/crm | CRM | pass | 8260 | 6 | 4 | 2 | found | 12 | useful | useful | useful | not_detected | live | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 79 | HubSpot | https://www.hubspot.com | CRM | pass | 7149 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 80 | Streak | https://www.streak.com | CRM | pass | 7574 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 81 | Intercom | https://www.intercom.com | support | pass | 6968 | 6 | 2 | 4 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 82 | Zendesk | https://www.zendesk.com | support | pass | 9323 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | redirected | complete | 9 | - | - | Deliver homepage-derived intelligence first and move deeper discovery to background retries. | medium | high |
| 83 | Help Scout | https://www.helpscout.com | support | pass | 7712 | 6 | 4 | 2 | found | 12 | useful | useful | useful | found | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 84 | Crisp | https://crisp.chat | support | pass | 6313 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 85 | Tawk.to | https://www.tawk.to | support | pass | 6669 | 6 | 3 | 3 | found | 4 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 86 | Freshdesk | https://www.freshworks.com/freshdesk | support | pass | 7874 | 6 | 2 | 4 | found | 2 | useful | useful | useful | not_detected | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 87 | Front | https://front.com | support | pass | 6971 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 88 | Gorgias | https://www.gorgias.com | support | pass | 4579 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 89 | Kustomer | https://www.kustomer.com | support | pass | 3371 | 6 | 3 | 3 | contact_sales | 3 | useful | useful | useful | found | redirected | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 90 | Zammad | https://zammad.com | support | pass | 3458 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 91 | Patreon | https://www.patreon.com | creator tools | pass | 6171 | 6 | 3 | 3 | found | 1 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 92 | Substack | https://substack.com | creator tools | pass | 2629 | 6 | 2 | 4 | found | 1 | useful | useful | useful | not_detected | live | complete | 10 | - | - | No immediate fix; monitor for regressions. | low | low |
| 93 | Gumroad | https://gumroad.com | creator tools | partial | 3085 | 6 | 1 | 5 | unclear | 0 | useful | useful | weak | not_detected | live | complete | 6 | pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules<br>only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals | pricing may require deeper discovery, interaction, or client-rendered content<br>feature extraction needs clearer product sections and does not infer features from vague marketing copy<br>sitemap expansion is budgeted and may skip slow sitemap branches | Queue targeted pricing-only retries for pricing/plans/packages/FAQ candidates instead of rerunning full scans. | medium | high |
| 94 | Kajabi | https://kajabi.com | creator tools | pass | 2190 | 6 | 3 | 3 | found | 12 | useful | useful | useful | found | live | complete | 10 | - | - | No immediate fix; monitor for regressions. | low | low |
| 95 | Teachable | https://teachable.com | creator tools | pass | 3936 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 96 | Podia | https://www.podia.com | creator tools | pass | 3956 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 9.5 | - | - | No immediate fix; monitor for regressions. | low | low |
| 97 | Ghost | https://ghost.org | creator tools | pass | 2746 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 10 | - | - | No immediate fix; monitor for regressions. | low | low |
| 98 | Memberful | https://memberful.com | creator tools | pass | 2804 | 6 | 3 | 3 | found | 7 | useful | useful | useful | not_detected | live | complete | 10 | - | - | No immediate fix; monitor for regressions. | low | low |
| 99 | Ko-fi | https://ko-fi.com | creator tools | pass | 2528 | 6 | 2 | 4 | found | 10 | useful | useful | useful | not_detected | live | complete | 10 | - | - | No immediate fix; monitor for regressions. | low | low |
| 100 | Buy Me a Coffee | https://www.buymeacoffee.com | creator tools | pass | 2385 | 6 | 3 | 3 | found | 12 | useful | useful | useful | not_detected | live | complete | 10 | - | - | No immediate fix; monitor for regressions. | low | low |

## SECTION C - Failure log

### 1. Carrd

- URL: https://carrd.co
- Status: partial
- Duration: 5158ms
- Failure reasons:
- no non-auth hero/link/button CTA survived ranking
- Recommended fix: Improve CTA precedence so hero and above-the-fold conversion links beat nav/footer/passive links.
- Priority: high

### 9. Bubble

- URL: https://bubble.io
- Status: partial
- Duration: 4950ms
- Failure reasons:
- pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules
- no non-auth hero/link/button CTA survived ranking
- only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals
- Recommended fix: Queue targeted pricing-only retries for pricing/plans/packages/FAQ candidates instead of rerunning full scans.
- Priority: high

### 13. Simple Analytics

- URL: https://www.simpleanalytics.com
- Status: partial
- Duration: 3066ms
- Failure reasons:
- no non-auth hero/link/button CTA survived ranking
- Recommended fix: Improve CTA precedence so hero and above-the-fold conversion links beat nav/footer/passive links.
- Priority: high

### 14. PostHog

- URL: https://posthog.com
- Status: partial
- Duration: 6727ms
- Failure reasons:
- only 1 reliable feature facts were extracted; target is at least 3 clear feature/product signals
- Recommended fix: Tighten feature section detection and add table/card parsing without using testimonial/proof text.
- Priority: medium

### 16. Amplitude

- URL: https://amplitude.com
- Status: partial
- Duration: 6869ms
- Failure reasons:
- contact-sales fixture produced a visible-price classification, indicating pricing precision risk for enterprise pages
- Recommended fix: No immediate fix; monitor for regressions.
- Priority: low

### 25. New Relic

- URL: https://newrelic.com
- Status: partial
- Duration: 7383ms
- Failure reasons:
- pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules
- only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals
- Recommended fix: Queue targeted pricing-only retries for pricing/plans/packages/FAQ candidates instead of rerunning full scans.
- Priority: high

### 34. Perplexity

- URL: https://www.perplexity.ai
- Status: fail
- Duration: 4083ms
- Failure reasons:
- all discovered candidate pages failed or returned no meaningful static text
- pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules
- positioning lacked a clear category, target customer, use case, or non-generic value proposition
- no non-auth hero/link/button CTA survived ranking
- only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals
- baseline did not produce enough structured profile hashes or watchlist suggestions
- Recommended fix: Add blocked/JS-heavy classification plus background browser fallback for admin-reviewed cases.
- Priority: high

### 35. Cursor

- URL: https://cursor.com
- Status: partial
- Duration: 3680ms
- Failure reasons:
- pricing expected as visible, but extracted evidence only supported a contact-sales pricing path
- Recommended fix: No immediate fix; monitor for regressions.
- Priority: low

### 49. Loops

- URL: https://loops.so
- Status: partial
- Duration: 7786ms
- Failure reasons:
- pricing expected as visible, but extracted evidence only supported a contact-sales pricing path
- Recommended fix: No immediate fix; monitor for regressions.
- Priority: low

### 55. Render

- URL: https://render.com
- Status: partial
- Duration: 4571ms
- Failure reasons:
- pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules
- no non-auth hero/link/button CTA survived ranking
- only 1 reliable feature facts were extracted; target is at least 3 clear feature/product signals
- Recommended fix: Queue targeted pricing-only retries for pricing/plans/packages/FAQ candidates instead of rerunning full scans.
- Priority: high

### 76. Copper

- URL: https://www.copper.com
- Status: partial
- Duration: 6696ms
- Failure reasons:
- positioning lacked a clear category, target customer, use case, or non-generic value proposition
- Recommended fix: Add a stricter homepage hero/category fallback using title, meta description, H1, and first paragraph only.
- Priority: medium

### 93. Gumroad

- URL: https://gumroad.com
- Status: partial
- Duration: 3085ms
- Failure reasons:
- pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules
- only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals
- Recommended fix: Queue targeted pricing-only retries for pricing/plans/packages/FAQ candidates instead of rerunning full scans.
- Priority: high


## SECTION D - Current limitations

### Carrd

- CTA ranking may miss hero actions or reject passive but intentional CTAs
- sitemap expansion is budgeted and may skip slow sitemap branches

### Bubble

- pricing may require deeper discovery, interaction, or client-rendered content
- CTA ranking may miss hero actions or reject passive but intentional CTAs
- feature extraction needs clearer product sections and does not infer features from vague marketing copy
- sitemap expansion is budgeted and may skip slow sitemap branches

### Simple Analytics

- CTA ranking may miss hero actions or reject passive but intentional CTAs
- sitemap expansion is budgeted and may skip slow sitemap branches

### PostHog

- feature extraction needs clearer product sections and does not infer features from vague marketing copy
- sitemap expansion is budgeted and may skip slow sitemap branches

### Amplitude

- sitemap expansion is budgeted and may skip slow sitemap branches

### New Relic

- pricing may require deeper discovery, interaction, or client-rendered content
- feature extraction needs clearer product sections and does not infer features from vague marketing copy
- sitemap expansion is budgeted and may skip slow sitemap branches

### Perplexity

- static analyzer could not obtain useful public HTML from selected candidates
- pricing may require deeper discovery, interaction, or client-rendered content
- CTA ranking may miss hero actions or reject passive but intentional CTAs
- feature extraction needs clearer product sections and does not infer features from vague marketing copy
- positioning extraction rejects broad slogans without category or audience evidence

### Cursor

- sitemap expansion is budgeted and may skip slow sitemap branches

### Loops

- sitemap expansion is budgeted and may skip slow sitemap branches

### Render

- pricing may require deeper discovery, interaction, or client-rendered content
- CTA ranking may miss hero actions or reject passive but intentional CTAs
- feature extraction needs clearer product sections and does not infer features from vague marketing copy
- sitemap expansion is budgeted and may skip slow sitemap branches

### Copper

- positioning extraction rejects broad slogans without category or audience evidence
- sitemap expansion is budgeted and may skip slow sitemap branches

### Gumroad

- pricing may require deeper discovery, interaction, or client-rendered content
- feature extraction needs clearer product sections and does not infer features from vague marketing copy
- sitemap expansion is budgeted and may skip slow sitemap branches


## SECTION E - Root cause groups

| root_cause | affected_cases | severity | examples | likely_root_cause | recommended_fix | difficulty | expected_gain |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pricing discovery or parsing failure | 8 | high | Bubble: pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules<br>Amplitude: contact-sales fixture produced a visible-price classification, indicating pricing precision risk for enterprise pages<br>New Relic: pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules<br>Perplexity: pricing expected as visible, but no currency-plus-billing candidate passed deterministic evidence rules<br>Cursor: pricing expected as visible, but extracted evidence only supported a contact-sales pricing path | pricing pages are non-standard, require interaction, or expose prices in layouts the deterministic extractor does not yet model | add targeted pricing-only retries and support plan tables/toggles without blocking first insight | medium | medium |
| feature extraction noise or scarcity | 6 | medium | Bubble: only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals<br>PostHog: only 1 reliable feature facts were extracted; target is at least 3 clear feature/product signals<br>New Relic: only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals<br>Perplexity: only 0 reliable feature facts were extracted; target is at least 3 clear feature/product signals<br>Render: only 1 reliable feature facts were extracted; target is at least 3 clear feature/product signals | feature sections are sparse, card-like, or mixed with testimonial/proof content | improve feature-card/table parsing and keep testimonial/proof text out of features | medium | medium |
| CTA ranking failure | 5 | medium | Carrd: no non-auth hero/link/button CTA survived ranking<br>Bubble: no non-auth hero/link/button CTA survived ranking<br>Simple Analytics: no non-auth hero/link/button CTA survived ranking<br>Perplexity: no non-auth hero/link/button CTA survived ranking<br>Render: no non-auth hero/link/button CTA survived ranking | CTA extraction is still too dependent on detected links/buttons and can miss intended hero actions | prioritize hero/above-the-fold CTAs over nav/footer and classify passive CTAs separately | low | medium |
| positioning specificity failure | 2 | low | Perplexity: positioning lacked a clear category, target customer, use case, or non-generic value proposition<br>Copper: positioning lacked a clear category, target customer, use case, or non-generic value proposition | homepage copy lacks explicit category/audience/use-case signals or those signals are not prioritized | limit fallback to title/meta/H1/hero/first paragraph and downgrade broad slogans | low | low |
| blocked or unavailable site | 1 | high | Perplexity: all discovered candidate pages failed or returned no meaningful static text | target site blocks automated requests, exposes an empty app shell, or returns unusable static HTML | classify blocked/JS-heavy sites clearly and optionally retry in background with browser fallback | high | low |
| baseline/watchlist coverage | 1 | low | Perplexity: baseline did not produce enough structured profile hashes or watchlist suggestions | structured facts were too sparse to create a useful watchlist | generate watchlist from available dimensions and label missing dimensions explicitly | low | low |

## SECTION F - Top 5 recommended fixes

| rank | fix | why | expected_effect | difficulty | priority |
| --- | --- | --- | --- | --- | --- |
| 1 | Decouple first useful insight from full crawl completion with staged scan delivery. | Performance gate failed: median 6313ms, p95 11486ms. | +high perceived reliability and lower abandonment | medium | high |
| 2 | add targeted pricing-only retries and support plan tables/toggles without blocking first insight | 8 affected cases in pricing discovery or parsing failure. | +medium reliability | medium | high |
| 3 | improve feature-card/table parsing and keep testimonial/proof text out of features | 6 affected cases in feature extraction noise or scarcity. | +medium reliability | medium | medium |
| 4 | prioritize hero/above-the-fold CTAs over nav/footer and classify passive CTAs separately | 5 affected cases in CTA ranking failure. | +medium reliability | low | medium |
| 5 | limit fallback to title/meta/H1/hero/first paragraph and downgrade broad slogans | 2 affected cases in positioning specificity failure. | +low reliability | low | medium |

## SECTION G - Launch risk assessment

- Accuracy risk: medium-low. Pricing precision is 99/100 and evidence status is complete on successful analyses.
- Completeness risk: medium. Pricing recall is 93/100 and feature usefulness is 94/100.
- Delivery risk: high. Performance gate failed and 24 simulated users hit slow-analysis dropoff.
- Trust risk: low. Trust score is 99/100 and counterexamples scored 100/100.
- Cost risk: low. AI was disabled and OpenAI calls were 0.

## SECTION H - Recommendation

2. Fix specific blockers then launch.

Do not output READY TO SHIP yet because reliability, UX, and performance gates did not all pass. The next pass should focus on progressive delivery and targeted retries, not broad extraction rewrites.

FIX BLOCKERS FIRST
