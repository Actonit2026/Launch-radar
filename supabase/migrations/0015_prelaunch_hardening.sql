alter table public.users
  alter column scan_interval_hours set default 168;

update public.users
set scan_interval_hours = 168
where plan = 'free'
  and scan_interval_hours = 24;

alter table public.recommendation_feedback
  drop constraint if exists recommendation_feedback_feedback_check;

alter table public.recommendation_feedback
  add constraint recommendation_feedback_feedback_check
  check (
    feedback in (
      'useful',
      'not_useful',
      'already_knew',
      'implemented',
      'saved',
      'rejected',
      'hidden',
      'resolved'
    )
  );

create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  job_type text not null default 'manual_scan'
    check (job_type in ('manual_scan', 'scheduled_scan')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'deferred')),
  priority integer not null default 50,
  dedupe_key text not null,
  attempts integer not null default 0,
  last_error text,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scan_jobs_status_priority_available_idx
  on public.scan_jobs (status, priority desc, available_at asc, created_at asc);

create index if not exists scan_jobs_user_created_idx
  on public.scan_jobs (user_id, created_at desc);

create unique index if not exists scan_jobs_active_dedupe_idx
  on public.scan_jobs (dedupe_key)
  where status in ('queued', 'running', 'deferred');

alter table public.scan_jobs enable row level security;

drop policy if exists "Users can read own scan jobs"
  on public.scan_jobs;
create policy "Users can read own scan jobs"
  on public.scan_jobs for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own scan jobs"
  on public.scan_jobs;
create policy "Users can insert own scan jobs"
  on public.scan_jobs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
