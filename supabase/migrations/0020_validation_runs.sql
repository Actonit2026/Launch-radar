create table if not exists public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (
    run_type in (
      'full_suite',
      'single_url',
      'scenario',
      'follow_up',
      'homepage_examples'
    )
  ),
  status text not null check (status in ('passed', 'failed', 'partial')),
  case_count integer not null default 0,
  passed_count integer not null default 0,
  report_json jsonb not null default '{}'::jsonb,
  failures text[] not null default '{}',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.validation_runs enable row level security;

drop policy if exists "validation_runs_service_only" on public.validation_runs;
create policy "validation_runs_service_only"
  on public.validation_runs
  for all
  using (false)
  with check (false);

create index if not exists validation_runs_created_at_idx
  on public.validation_runs (created_at desc);
