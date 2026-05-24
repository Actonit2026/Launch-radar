alter table public.monitored_pages
  add column if not exists last_fetch_status text,
  add column if not exists last_http_status integer,
  add column if not exists last_error_type text,
  add column if not exists last_error_message text,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_failure_at timestamptz,
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists availability_status text not null default 'unknown';

alter table public.snapshots
  add column if not exists fetch_status text,
  add column if not exists http_status integer,
  add column if not exists final_url text,
  add column if not exists error_type text,
  add column if not exists error_message text,
  add column if not exists was_successful boolean;

alter table public.detected_changes
  add column if not exists category text,
  add column if not exists old_value jsonb,
  add column if not exists new_value jsonb,
  add column if not exists evidence_text text;

create index if not exists monitored_pages_availability_status_idx
  on public.monitored_pages (availability_status, last_failure_at desc);
