drop policy if exists "No client access to plan limits"
  on public.plan_limits;
create policy "No client access to plan limits"
  on public.plan_limits for select
  to authenticated
  using (false);

drop policy if exists "No client access to public URL cache"
  on public.public_url_cache;
create policy "No client access to public URL cache"
  on public.public_url_cache for select
  to authenticated
  using (false);

drop policy if exists "No client access to seed intelligence"
  on public.seed_intelligence;
create policy "No client access to seed intelligence"
  on public.seed_intelligence for select
  to authenticated
  using (false);
