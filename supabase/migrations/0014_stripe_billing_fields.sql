alter table public.users
  add column if not exists billing_subscription_id text;

create index if not exists users_billing_customer_id_idx
  on public.users (billing_customer_id);

create index if not exists users_billing_subscription_id_idx
  on public.users (billing_subscription_id);
