create table if not exists public.v3_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  analyzed_url text not null,
  canonical_url text not null,
  analyzer_version text not null default 'v3'
    check (analyzer_version = 'v3'),
  business_model jsonb not null default '{}'::jsonb,
  pricing_model jsonb not null default '{}'::jsonb,
  homepage_model jsonb not null default '{}'::jsonb,
  positioning_model jsonb not null default '{}'::jsonb,
  cta_model jsonb not null default '{}'::jsonb,
  feature_model jsonb not null default '{}'::jsonb,
  changelog_model jsonb not null default '{}'::jsonb,
  availability_model jsonb not null default '{}'::jsonb,
  validity text not null
    check (
      validity in (
        'verified',
        'partial',
        'unknown',
        'blocked',
        'unavailable',
        'invalid_for_intelligence'
      )
    ),
  confidence text not null
    check (confidence in ('high', 'medium', 'low')),
  completeness numeric not null default 0,
  evidence_count integer not null default 0,
  rejected_entities jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  source_pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists v3_intelligence_user_created_idx
  on public.v3_intelligence_snapshots (user_id, created_at desc);

create index if not exists v3_intelligence_competitor_created_idx
  on public.v3_intelligence_snapshots (competitor_id, created_at desc);

create table if not exists public.v3_shadow_output (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  monitored_page_id uuid references public.monitored_pages(id) on delete set null,
  analyzer_version text not null default 'v3'
    check (analyzer_version = 'v3'),
  old_analyzer_summary jsonb not null default '{}'::jsonb,
  business_model jsonb not null default '{}'::jsonb,
  validity text not null,
  confidence text not null
    check (confidence in ('high', 'medium', 'low')),
  pricing_status text not null,
  pricing_confidence text not null
    check (pricing_confidence in ('high', 'medium', 'low')),
  accepted_price_count integer not null default 0,
  rejected_price_count integer not null default 0,
  displayed_price_count integer,
  dangerous_output boolean not null default false,
  comparison_notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists v3_shadow_user_created_idx
  on public.v3_shadow_output (user_id, created_at desc);

create index if not exists v3_shadow_competitor_created_idx
  on public.v3_shadow_output (competitor_id, created_at desc);

alter table public.detected_changes
  add column if not exists analyzer_version text,
  add column if not exists change_model_type text,
  add column if not exists source_snapshot_id uuid references public.v3_intelligence_snapshots(id) on delete set null,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'quarantined', 'legacy_quarantined'));

create index if not exists detected_changes_v3_user_visible_idx
  on public.detected_changes (analyzer_version, status, confidence_score, created_at desc);

update public.detected_changes
set status = 'legacy_quarantined'
where analyzer_version is distinct from 'v3';

update public.detected_changes
set status = 'quarantined'
where analyzer_version = 'v3'
  and (
    coalesce(confidence_score, 0) < 0.72
    or evidence_json::text ~* '[?&](utm_|gclid|fbclid|msclkid)'
    or diff_summary ~* 'percent|raw text|duplicate homepage|utm_|gclid|fbclid|msclkid'
  );

alter table public.v3_intelligence_snapshots enable row level security;
alter table public.v3_shadow_output enable row level security;

drop policy if exists "Users can read own v3 intelligence snapshots"
  on public.v3_intelligence_snapshots;
create policy "Users can read own v3 intelligence snapshots"
  on public.v3_intelligence_snapshots for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own v3 intelligence snapshots"
  on public.v3_intelligence_snapshots;
create policy "Users can insert own v3 intelligence snapshots"
  on public.v3_intelligence_snapshots for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own v3 shadow output"
  on public.v3_shadow_output;
create policy "Users can read own v3 shadow output"
  on public.v3_shadow_output for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own v3 shadow output"
  on public.v3_shadow_output;
create policy "Users can insert own v3 shadow output"
  on public.v3_shadow_output for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
