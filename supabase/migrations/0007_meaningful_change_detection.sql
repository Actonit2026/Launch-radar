alter table public.snapshots
  add column if not exists raw_content_hash text,
  add column if not exists canonical_content_hash text,
  add column if not exists structured_facts_hash text,
  add column if not exists structured_facts_json jsonb not null default '{}'::jsonb;

update public.snapshots
set raw_content_hash = coalesce(raw_content_hash, hash)
where raw_content_hash is null;

create index if not exists snapshots_monitored_page_structured_hash_idx
  on public.snapshots (monitored_page_id, structured_facts_hash, created_at desc);

alter table public.detected_changes
  add column if not exists change_type text,
  add column if not exists confidence_score numeric,
  add column if not exists evidence_json jsonb not null default '[]'::jsonb;
