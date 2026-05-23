drop policy if exists "Service role manages demo examples" on public.demo_example_results;

create policy "Service role manages demo examples"
  on public.demo_example_results for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');
