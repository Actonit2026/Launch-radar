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

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase project URL and anon key.
3. Run `npm run dev`.

## Production Environment

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY`
- `OPENAI_SUMMARY_MODEL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Cost guard defaults:

- `MONTHLY_COST_BUDGET_EUR=20`
- `AI_MONTHLY_TOKEN_LIMIT=400000`
- `MAX_SCANS_PER_DAY_GLOBAL=80`
- `MAX_AI_CALLS_PER_DAY_GLOBAL=50`
- `MAX_PAGES_PER_SCAN=15`
- `AI_ESTIMATED_EUR_PER_1K_TOKENS=0.0002`
