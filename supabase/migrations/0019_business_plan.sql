alter table public.users
  drop constraint if exists users_plan_check;

alter table public.users
  add constraint users_plan_check
  check (plan in ('free', 'pro', 'business'));

update public.users
set
  competitor_limit = case
    when plan = 'business' then 999
    when plan = 'pro' then 20
    else 3
  end,
  scan_interval_hours = case
    when plan = 'business' then 6
    when plan = 'pro' then 12
    else 168
  end
where competitor_limit is null
   or scan_interval_hours is null;
