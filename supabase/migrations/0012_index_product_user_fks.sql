create index if not exists product_snapshots_user_id_idx
  on public.product_snapshots (user_id);

create index if not exists product_recommendations_user_id_idx
  on public.product_recommendations (user_id);
