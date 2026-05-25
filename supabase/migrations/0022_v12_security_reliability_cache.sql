create table if not exists public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (id, email, created_at, updated_at)
select id, email, created_at, now()
from public.users
on conflict (id) do nothing;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'business')),
  status text not null default 'inactive',
  current_period_end timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_limits (
  plan text primary key check (plan in ('free', 'pro', 'business')),
  competitor_limit integer not null,
  own_product_limit integer not null,
  scan_interval_hours integer not null,
  max_pages_per_scan integer not null,
  manual_refreshes_per_day integer not null,
  ai_enabled boolean not null default false,
  browser_fallback_enabled boolean not null default false,
  cache_ttl_hours integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plan_limits (
  plan,
  competitor_limit,
  own_product_limit,
  scan_interval_hours,
  max_pages_per_scan,
  manual_refreshes_per_day,
  ai_enabled,
  browser_fallback_enabled,
  cache_ttl_hours
) values
  ('free', 3, 1, 168, 2, 1, false, false, 168),
  ('pro', 20, 3, 12, 15, 5, true, false, 12),
  ('business', 999, 10, 6, 15, 25, true, true, 12)
on conflict (plan) do update set
  competitor_limit = excluded.competitor_limit,
  own_product_limit = excluded.own_product_limit,
  scan_interval_hours = excluded.scan_interval_hours,
  max_pages_per_scan = excluded.max_pages_per_scan,
  manual_refreshes_per_day = excluded.manual_refreshes_per_day,
  ai_enabled = excluded.ai_enabled,
  browser_fallback_enabled = excluded.browser_fallback_enabled,
  cache_ttl_hours = excluded.cache_ttl_hours,
  updated_at = now();

create table if not exists public.public_url_cache (
  normalized_url text primary key,
  homepage_hash text,
  pricing_json jsonb not null default '{}'::jsonb,
  positioning_json jsonb not null default '{}'::jsonb,
  cta_json jsonb not null default '{}'::jsonb,
  feature_json jsonb not null default '{}'::jsonb,
  availability jsonb not null default '{}'::jsonb,
  confidence text not null default 'low'
    check (confidence in ('high', 'medium', 'low')),
  scan_quality jsonb not null default '{}'::jsonb,
  last_scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seed_intelligence (
  normalized_url text primary key,
  site_name text,
  structured_facts_json jsonb not null default '[]'::jsonb,
  analyzed_pages jsonb not null default '[]'::jsonb,
  confidence text not null default 'low'
    check (confidence in ('high', 'medium', 'low')),
  source text not null default 'deterministic_seed'
    check (source = 'deterministic_seed'),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx
  on public.profiles (lower(email));

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);

create index if not exists public_url_cache_last_scanned_idx
  on public.public_url_cache (last_scanned_at desc);

create index if not exists seed_intelligence_last_verified_idx
  on public.seed_intelligence (last_verified_at desc);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.plan_limits enable row level security;
alter table public.public_url_cache enable row level security;
alter table public.seed_intelligence enable row level security;

drop policy if exists "Users can read own profile"
  on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile"
  on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can read own subscriptions"
  on public.subscriptions;
create policy "Users can read own subscriptions"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);
