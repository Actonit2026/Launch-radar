alter policy "Users can read own profile"
  on public.users
  using ((select auth.uid()) = id);

alter policy "Users can insert own profile"
  on public.users
  with check ((select auth.uid()) = id);

alter policy "Users can update own profile"
  on public.users
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "Users can manage own competitors"
  on public.competitors
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can manage own monitored pages"
  on public.monitored_pages
  using (
    exists (
      select 1
      from public.competitors
      where competitors.id = monitored_pages.competitor_id
        and competitors.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.competitors
      where competitors.id = monitored_pages.competitor_id
        and competitors.user_id = (select auth.uid())
    )
  );

alter policy "Users can read own snapshots"
  on public.snapshots
  using (
    exists (
      select 1
      from public.monitored_pages
      join public.competitors
        on competitors.id = monitored_pages.competitor_id
      where monitored_pages.id = snapshots.monitored_page_id
        and competitors.user_id = (select auth.uid())
    )
  );

alter policy "Users can insert own snapshots"
  on public.snapshots
  with check (
    exists (
      select 1
      from public.monitored_pages
      join public.competitors
        on competitors.id = monitored_pages.competitor_id
      where monitored_pages.id = snapshots.monitored_page_id
        and competitors.user_id = (select auth.uid())
    )
  );

alter policy "Users can read own detected changes"
  on public.detected_changes
  using (
    exists (
      select 1
      from public.monitored_pages
      join public.competitors
        on competitors.id = monitored_pages.competitor_id
      where monitored_pages.id = detected_changes.monitored_page_id
        and competitors.user_id = (select auth.uid())
    )
  );

alter policy "Users can insert own detected changes"
  on public.detected_changes
  with check (
    exists (
      select 1
      from public.monitored_pages
      join public.competitors
        on competitors.id = monitored_pages.competitor_id
      where monitored_pages.id = detected_changes.monitored_page_id
        and competitors.user_id = (select auth.uid())
    )
  );

alter policy "Users can read own intelligence snapshots"
  on public.competitor_intelligence_snapshots
  using (
    exists (
      select 1
      from public.competitors
      where competitors.id = competitor_intelligence_snapshots.competitor_id
        and competitors.user_id = (select auth.uid())
    )
  );

alter policy "Users can insert own intelligence snapshots"
  on public.competitor_intelligence_snapshots
  with check (
    exists (
      select 1
      from public.competitors
      where competitors.id = competitor_intelligence_snapshots.competitor_id
        and competitors.user_id = (select auth.uid())
    )
  );

alter policy "Users can read own scan debug logs"
  on public.scan_debug_logs
  using (
    exists (
      select 1
      from public.competitors
      where competitors.id = scan_debug_logs.competitor_id
        and competitors.user_id = (select auth.uid())
    )
  );

alter policy "Users can insert own scan debug logs"
  on public.scan_debug_logs
  with check (
    exists (
      select 1
      from public.competitors
      where competitors.id = scan_debug_logs.competitor_id
        and competitors.user_id = (select auth.uid())
    )
  );
