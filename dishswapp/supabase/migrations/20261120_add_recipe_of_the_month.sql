-- Assign at most one recipe to each recurring month of the year.
alter table public.recipes
  add column if not exists featured_month smallint
  check (featured_month between 1 and 12);

create unique index if not exists recipes_one_feature_per_month_idx
  on public.recipes (featured_month)
  where featured_month is not null;
