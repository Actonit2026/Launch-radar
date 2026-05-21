create table if not exists public.scan_debug_logs (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  run_type text not null
    check (run_type in ('initial_setup', 'manual_analysis', 'manual_scan')),
  status text not null
    check (status in ('success', 'partial', 'failed')),
  normalized_url text,
  submitted_url text,
  payload jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}',
  errors text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists scan_debug_logs_competitor_id_created_at_idx
  on public.scan_debug_logs (competitor_id, created_at desc);

alter table public.scan_debug_logs enable row level security;

drop policy if exists "Users can read own scan debug logs"
  on public.scan_debug_logs;
create policy "Users can read own scan debug logs"
  on public.scan_debug_logs for select
  using (
    exists (
      select 1
      from public.competitors
      where competitors.id = scan_debug_logs.competitor_id
        and competitors.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own scan debug logs"
  on public.scan_debug_logs;
create policy "Users can insert own scan debug logs"
  on public.scan_debug_logs for insert
  with check (
    exists (
      select 1
      from public.competitors
      where competitors.id = scan_debug_logs.competitor_id
        and competitors.user_id = auth.uid()
    )
  );
