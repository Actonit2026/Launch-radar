create index if not exists detected_changes_source_snapshot_id_idx
  on public.detected_changes (source_snapshot_id);

create index if not exists v3_shadow_output_monitored_page_id_idx
  on public.v3_shadow_output (monitored_page_id);
