create table if not exists public.demo_example_results (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  site_url text not null,
  source_url text not null,
  category text not null,
  slot integer not null default 0,
  rotation_week integer not null,
  status text not null default 'success'
    check (status in ('success', 'partial', 'failed')),
  positioning_result jsonb not null default '{}'::jsonb,
  pricing_result jsonb not null default '{}'::jsonb,
  cta_result jsonb not null default '{}'::jsonb,
  feature_result jsonb not null default '{}'::jsonb,
  changelog_result jsonb not null default '{}'::jsonb,
  analysis_json jsonb not null default '{}'::jsonb,
  evidence_json jsonb not null default '[]'::jsonb,
  confidence text not null default 'low'
    check (confidence in ('high', 'medium', 'low')),
  last_verified_at timestamptz,
  analyzer_version text not null,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, rotation_week)
);

create index if not exists demo_example_results_status_week_slot_idx
  on public.demo_example_results (status, rotation_week desc, slot asc);

create index if not exists demo_example_results_last_verified_idx
  on public.demo_example_results (last_verified_at desc);

alter table public.demo_example_results enable row level security;

drop policy if exists "Service role manages demo examples" on public.demo_example_results;
create policy "Service role manages demo examples"
  on public.demo_example_results for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
