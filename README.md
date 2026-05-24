# LaunchRadar

Competitor intelligence for SaaS founders.

## Phase 1

This phase sets up:

- Next.js 15 with TypeScript and Tailwind
- Supabase client/server integration
- Email/password sign up, sign in, sign out
- Session middleware and a protected dashboard shell

## Phase 2

This phase adds:

- Supabase schema for users, competitors, monitored pages, snapshots, and detected changes
- Row-level security policies for per-user data access
- Dashboard competitor CRUD
- Competitor detail pages with tracked pages and change history

Run `supabase/migrations/0001_initial_schema.sql` in your Supabase SQL editor before testing CRUD with a real account.

## Phase 3

This phase adds:

- Playwright-based page rendering
- Cheerio-based meaningful text extraction
- Candidate page discovery for homepage, pricing, features, and changelog/blog pages
- Baseline snapshots when competitors are added
- `GET`/`POST /api/scan` for manual scans

Run `supabase/migrations/0002_allow_snapshot_writes.sql` before saving snapshots through authenticated users.

## Phase 4

This phase adds:

- Text snapshot diffing
- Heuristic change summaries
- Severity scoring
- `detected_changes` persistence during scans

Run `supabase/migrations/0003_allow_detected_change_writes.sql` before saving detected changes through authenticated users.

## Phase 5

This phase adds:

- Resend email notification wiring
- Email alerts for medium and high severity changes
- `POST /api/notify` for manually sending a detected-change alert

Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to send real email.

## Phase 6

This phase adds:

- OpenAI-powered summaries through the Responses API
- Structured JSON output for verified competitor intelligence
- Deterministic fallback when `OPENAI_API_KEY` is not configured
- A rule that OpenAI only receives structured facts with source evidence, not raw page text

Set `OPENAI_API_KEY` and optionally `OPENAI_SUMMARY_MODEL` to enable AI summaries.

## Phase 7

This phase adds:

- First-scan intelligence snapshot generation
- Baseline snapshots without detected-change records
- No alert emails during the first baseline scan
- Competitor scan status fields for setup/ready/failed states

Run `supabase/migrations/0004_intelligence_snapshots.sql` to persist intelligence snapshots and scan status in Supabase.

## Production Readiness Additions

The current build also includes:

- URL-first competitor setup with evidence-backed page discovery and structured analysis
- Meaningful change detection that ignores casing, whitespace, punctuation, boilerplate, and raw HTML noise
- Cached real homepage examples so public visitors do not trigger scans
- Business plan support with up to 999 competitors, 6-hour refreshes, priority queueing, and higher scan/render allowances
- Improved signup, login, email confirmation, forgot-password, and reset-password flows
- Free and Pro plan limits, upgrade prompts, and Stripe Checkout/Portal wiring
- Your Product analysis with evidence-backed competitor comparison recommendations
- Recommendation trust gates for consensus, confidence, novelty, actionability, priority, and feedback tracking
- Usage events, AI summary caching, scan limits, and global budget guardrails
- Deterministic page modeling for hero, pricing, CTA, feature, changelog, nav, footer, and auth sections
- Cost-safe analysis mode where AI summaries are optional and core extraction works without AI
- Pre-launch hardening for public crawler identity, Terms, Privacy, health checks, retention cleanup, weekly digests, optional scan queueing, SSRF/path blocking, robots-aware crawling, and admin cost metrics

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase project URL and anon key.
3. Run `npm run dev`.
4. Run `npm run test:phase11` and `npm run prelaunch:scorecard` before launch changes.

## Production Environment

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY`
- `OPENAI_SUMMARY_MODEL`
- `ENABLE_AI_SUMMARIES`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_PRO_ANNUAL_PRICE_ID` for the annual Pro checkout path
- `STRIPE_BUSINESS_PRICE_ID` for the Business monthly checkout path
- `STRIPE_BUSINESS_ANNUAL_PRICE_ID` for the Business annual checkout path
- `CRON_SECRET` for scheduled worker and maintenance endpoints
- `SCHEDULED_SCAN_USER_LIMIT` for the maximum users processed by each scheduled scan run
- `ADMIN_EMAILS` for the internal admin metrics page
- `MASTER_ADMIN_EMAILS` for server-side analyzer/debug and testing privileges

Stripe webhook endpoint:

- `/api/stripe/webhook`
- listen for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`

Scheduled endpoints:

- `GET`/`POST /api/scheduled-scans` scans due monitored pages for users, respecting scan intervals and usage limits
- `GET`/`POST /api/demo-examples/refresh` refreshes cached homepage proof examples with the deterministic analyzer
- `POST /api/scan-worker` processes one queued scan job when `ASYNC_SCAN_QUEUE_ENABLED=1`
- `GET`/`POST /api/weekly-digest` sends weekly no-change/change digest emails
- `GET`/`POST /api/maintenance/cleanup` applies snapshot retention cleanup

Cost guard defaults:

- `MONTHLY_COST_BUDGET_EUR=20`
- `AI_MONTHLY_TOKEN_LIMIT=400000`
- `MAX_SCANS_PER_DAY_GLOBAL=80`
- `MAX_SCANS_PER_USER_PER_DAY_FREE=1`
- `MAX_SCANS_PER_USER_PER_DAY_PRO=5`
- `MAX_SCANS_PER_USER_PER_DAY_BUSINESS=25`
- `MAX_AI_CALLS_PER_USER_PER_DAY=2`
- `MAX_AI_CALLS_GLOBAL_PER_DAY=50`
- `MAX_AI_CALLS_PER_DAY_GLOBAL=50`
- `MAX_BROWSER_RENDER_PER_USER_PER_DAY=3`
- `MAX_BROWSER_RENDER_PER_BUSINESS_PER_DAY=12`
- `MAX_BROWSER_RENDER_GLOBAL_PER_DAY=20`
- `MAX_PAGES_PER_SCAN=15`
- `AI_ESTIMATED_EUR_PER_1K_TOKENS=0.0002`
- `ASYNC_SCAN_QUEUE_ENABLED=0`
- `SCHEDULED_SCAN_USER_LIMIT=25`
- `LAUNCHRADAR_USER_AGENT=LaunchRadarBot/1.0`
- `LAUNCHRADAR_IGNORE_ROBOTS=0`
