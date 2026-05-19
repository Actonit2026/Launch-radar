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
