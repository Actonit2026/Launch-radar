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
