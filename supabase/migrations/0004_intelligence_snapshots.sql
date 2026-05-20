alter table public.competitors
  add column if not exists scan_status text not null default 'pending'
    check (scan_status in ('pending', 'running', 'ready', 'failed')),
  add column if not exists last_scan_at timestamptz,
  add column if not exists last_scan_error text;

create table if not exists public.competitor_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  summary jsonb not null,
  facts jsonb not null default '[]'::jsonb,
  analyzed_pages jsonb not null default '[]'::jsonb,
  warnings text[] not null default '{}',
  source text not null default 'deterministic'
    check (source in ('openai', 'deterministic')),
  created_at timestamptz not null default now()
);

create index if not exists competitor_intelligence_snapshots_competitor_id_created_at_idx
  on public.competitor_intelligence_snapshots (competitor_id, created_at desc);

alter table public.competitor_intelligence_snapshots enable row level security;

drop policy if exists "Users can read own intelligence snapshots"
  on public.competitor_intelligence_snapshots;
create policy "Users can read own intelligence snapshots"
  on public.competitor_intelligence_snapshots for select
  using (
    exists (
      select 1
      from public.competitors
      where competitors.id = competitor_intelligence_snapshots.competitor_id
        and competitors.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own intelligence snapshots"
  on public.competitor_intelligence_snapshots;
create policy "Users can insert own intelligence snapshots"
  on public.competitor_intelligence_snapshots for insert
  with check (
    exists (
      select 1
      from public.competitors
      where competitors.id = competitor_intelligence_snapshots.competitor_id
        and competitors.user_id = auth.uid()
    )
  );
