create table if not exists public.user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  base_url text not null,
  scan_status text not null default 'pending'
    check (scan_status in ('pending', 'running', 'ready', 'failed', 'deferred')),
  error_message text,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.product_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_product_id uuid not null references public.user_products(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  summary_json jsonb not null,
  structured_facts_json jsonb not null default '[]'::jsonb,
  analyzed_pages jsonb not null default '[]'::jsonb,
  warnings text[] not null default '{}',
  source text not null default 'deterministic'
    check (source in ('openai', 'deterministic')),
  created_at timestamptz not null default now()
);

create table if not exists public.product_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_product_id uuid not null references public.user_products(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  recommendation_type text not null,
  title text not null,
  explanation text not null,
  why_this_matters text not null,
  evidence_json jsonb not null default '{}'::jsonb,
  confidence integer not null check (confidence between 0 and 100),
  confidence_label text not null
    check (confidence_label in ('very_low', 'low', 'medium', 'high', 'very_high')),
  actionability text not null
    check (actionability in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create table if not exists public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.product_recommendations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  feedback text not null
    check (feedback in ('useful', 'not_useful', 'already_knew', 'implemented')),
  created_at timestamptz not null default now(),
  unique (recommendation_id, user_id)
);

create index if not exists user_products_user_id_idx
  on public.user_products (user_id);

create index if not exists product_snapshots_product_created_at_idx
  on public.product_snapshots (user_product_id, created_at desc);

create index if not exists product_recommendations_product_created_at_idx
  on public.product_recommendations (user_product_id, created_at desc);

create index if not exists recommendation_feedback_user_id_idx
  on public.recommendation_feedback (user_id);

alter table public.user_products enable row level security;
alter table public.product_snapshots enable row level security;
alter table public.product_recommendations enable row level security;
alter table public.recommendation_feedback enable row level security;

drop policy if exists "Users can manage own products"
  on public.user_products;
create policy "Users can manage own products"
  on public.user_products for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own product snapshots"
  on public.product_snapshots;
create policy "Users can read own product snapshots"
  on public.product_snapshots for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own product snapshots"
  on public.product_snapshots;
create policy "Users can insert own product snapshots"
  on public.product_snapshots for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own product recommendations"
  on public.product_recommendations;
create policy "Users can read own product recommendations"
  on public.product_recommendations for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own product recommendations"
  on public.product_recommendations;
create policy "Users can insert own product recommendations"
  on public.product_recommendations for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own product recommendations"
  on public.product_recommendations;
create policy "Users can delete own product recommendations"
  on public.product_recommendations for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own recommendation feedback"
  on public.recommendation_feedback;
create policy "Users can manage own recommendation feedback"
  on public.recommendation_feedback for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
