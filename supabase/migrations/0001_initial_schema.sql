do $$
begin
  create type public.page_type as enum (
    'homepage',
    'pricing',
    'features',
    'changelog'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.change_severity as enum (
    'low',
    'medium',
    'high'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  base_url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, base_url)
);

create table if not exists public.monitored_pages (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  url text not null,
  page_type public.page_type not null,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (competitor_id, page_type)
);

create table if not exists public.snapshots (
  id uuid primary key default gen_random_uuid(),
  monitored_page_id uuid not null references public.monitored_pages(id) on delete cascade,
  raw_text text not null,
  hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.detected_changes (
  id uuid primary key default gen_random_uuid(),
  monitored_page_id uuid not null references public.monitored_pages(id) on delete cascade,
  diff_summary text not null,
  severity public.change_severity not null default 'low',
  created_at timestamptz not null default now()
);

create index if not exists competitors_user_id_created_at_idx
  on public.competitors (user_id, created_at desc);

create index if not exists monitored_pages_competitor_id_idx
  on public.monitored_pages (competitor_id);

create index if not exists snapshots_monitored_page_id_created_at_idx
  on public.snapshots (monitored_page_id, created_at desc);

create index if not exists detected_changes_monitored_page_id_created_at_idx
  on public.detected_changes (monitored_page_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.users enable row level security;
alter table public.competitors enable row level security;
alter table public.monitored_pages enable row level security;
alter table public.snapshots enable row level security;
alter table public.detected_changes enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can manage own competitors" on public.competitors;
create policy "Users can manage own competitors"
  on public.competitors for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own monitored pages" on public.monitored_pages;
create policy "Users can manage own monitored pages"
  on public.monitored_pages for all
  using (
    exists (
      select 1
      from public.competitors
      where competitors.id = monitored_pages.competitor_id
        and competitors.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.competitors
      where competitors.id = monitored_pages.competitor_id
        and competitors.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own snapshots" on public.snapshots;
create policy "Users can read own snapshots"
  on public.snapshots for select
  using (
    exists (
      select 1
      from public.monitored_pages
      join public.competitors
        on competitors.id = monitored_pages.competitor_id
      where monitored_pages.id = snapshots.monitored_page_id
        and competitors.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own snapshots" on public.snapshots;
create policy "Users can insert own snapshots"
  on public.snapshots for insert
  with check (
    exists (
      select 1
      from public.monitored_pages
      join public.competitors
        on competitors.id = monitored_pages.competitor_id
      where monitored_pages.id = snapshots.monitored_page_id
        and competitors.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own detected changes" on public.detected_changes;
create policy "Users can read own detected changes"
  on public.detected_changes for select
  using (
    exists (
      select 1
      from public.monitored_pages
      join public.competitors
        on competitors.id = monitored_pages.competitor_id
      where monitored_pages.id = detected_changes.monitored_page_id
        and competitors.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own detected changes" on public.detected_changes;
create policy "Users can insert own detected changes"
  on public.detected_changes for insert
  with check (
    exists (
      select 1
      from public.monitored_pages
      join public.competitors
        on competitors.id = monitored_pages.competitor_id
      where monitored_pages.id = detected_changes.monitored_page_id
        and competitors.user_id = auth.uid()
    )
  );
