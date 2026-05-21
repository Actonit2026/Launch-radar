alter table public.users
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'pro')),
  add column if not exists competitor_limit integer not null default 3,
  add column if not exists scan_interval_hours integer not null default 24,
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists current_period_end timestamptz,
  add column if not exists billing_customer_id text;

update public.users
set
  competitor_limit = case when plan = 'pro' then 20 else 3 end,
  scan_interval_hours = case when plan = 'pro' then 12 else 24 end
where competitor_limit is null
   or scan_interval_hours is null;
