-- A member can save each public recipe once.
create table if not exists public.saved_recipes (
  user_id text not null,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create index if not exists saved_recipes_user_saved_at_idx
  on public.saved_recipes (user_id, saved_at desc);

alter table public.saved_recipes enable row level security;
