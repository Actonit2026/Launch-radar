create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  quantity integer not null default 1,
  estimated_cost_eur numeric(10, 6) not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_summary_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  cache_key text not null,
  model text not null,
  summary_json jsonb not null,
  source text not null default 'openai'
    check (source in ('openai', 'deterministic')),
  created_at timestamptz not null default now(),
  unique (user_id, cache_key)
);

create index if not exists usage_events_user_event_created_at_idx
  on public.usage_events (user_id, event_type, created_at desc);

create index if not exists usage_events_event_created_at_idx
  on public.usage_events (event_type, created_at desc);

create index if not exists ai_summary_cache_user_key_idx
  on public.ai_summary_cache (user_id, cache_key);

alter table public.usage_events enable row level security;
alter table public.ai_summary_cache enable row level security;

drop policy if exists "Users can read own usage events"
  on public.usage_events;
create policy "Users can read own usage events"
  on public.usage_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own usage events"
  on public.usage_events;
create policy "Users can insert own usage events"
  on public.usage_events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own ai summary cache"
  on public.ai_summary_cache;
create policy "Users can read own ai summary cache"
  on public.ai_summary_cache for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can write own ai summary cache"
  on public.ai_summary_cache;
create policy "Users can write own ai summary cache"
  on public.ai_summary_cache for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own ai summary cache"
  on public.ai_summary_cache;
create policy "Users can update own ai summary cache"
  on public.ai_summary_cache for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
