-- ============================================================
-- Homebase: Initial Schema + RLS
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Households
create table public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text unique not null default upper(substr(md5(random()::text), 1, 8)),
  created_at   timestamptz not null default now()
);

-- User profiles (extends auth.users)
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  household_id  uuid references public.households(id) on delete set null,
  display_name  text not null,
  role          text not null default 'member' check (role in ('owner', 'member')),
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- Chores
create table public.chores (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  title         text not null,
  description   text,
  assigned_to   uuid references public.profiles(id) on delete set null,
  recurrence    text check (recurrence in ('once','daily','weekly','biweekly','monthly')),
  due_date      date,
  completed_at  timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Maintenance items
create table public.maintenance_items (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  title              text not null,
  description        text,
  category           text,
  last_done          date,
  next_due           date,
  recurrence_months  integer check (recurrence_months > 0),
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- Budget accounts
create table public.budget_accounts (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  name               text not null,
  type               text not null check (type in ('checking','savings','credit','investment','cash')),
  plaid_item_id      text,
  plaid_access_token text,
  balance            numeric(12,2),
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now()
);

-- Budget transactions
create table public.budget_transactions (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references public.households(id) on delete cascade,
  account_id           uuid references public.budget_accounts(id) on delete set null,
  amount               numeric(12,2) not null,
  description          text not null,
  category             text,
  date                 date not null,
  source               text not null default 'manual' check (source in ('manual','csv','plaid')),
  plaid_transaction_id text unique,
  created_at           timestamptz not null default now()
);

-- Budget categories
create table public.budget_categories (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  name           text not null,
  budget_amount  numeric(12,2),
  color          text not null default '#6366f1',
  created_at     timestamptz not null default now()
);

-- Recipes
create table public.recipes (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  title           text not null,
  description     text,
  servings        integer check (servings > 0),
  prep_time_mins  integer check (prep_time_mins >= 0),
  cook_time_mins  integer check (cook_time_mins >= 0),
  ingredients     jsonb not null default '[]'::jsonb,
  instructions    jsonb not null default '[]'::jsonb,
  tags            text[] not null default '{}',
  image_url       text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Meal plan
create table public.meal_plan (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  date          date not null,
  meal_type     text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  recipe_id     uuid references public.recipes(id) on delete set null,
  custom_name   text,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (household_id, date, meal_type)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index on public.chores (household_id, completed_at, due_date);
create index on public.maintenance_items (household_id, next_due);
create index on public.budget_transactions (household_id, date desc);
create index on public.meal_plan (household_id, date);
create index on public.recipes (household_id);

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.households          enable row level security;
alter table public.profiles            enable row level security;
alter table public.chores              enable row level security;
alter table public.maintenance_items   enable row level security;
alter table public.budget_accounts     enable row level security;
alter table public.budget_transactions enable row level security;
alter table public.budget_categories   enable row level security;
alter table public.recipes             enable row level security;
alter table public.meal_plan           enable row level security;

-- Helper function: get current user's household_id
create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
as $$
  select household_id from public.profiles where id = auth.uid() limit 1;
$$;

-- ---- households ----
create policy "Members can view their household"
  on public.households for select
  using (id = public.my_household_id());

create policy "Owners can update their household"
  on public.households for update
  using (
    id = public.my_household_id()
    and (select role from public.profiles where id = auth.uid()) = 'owner'
  );

-- Allow insert during household creation (owner creates it)
create policy "Authenticated users can create households"
  on public.households for insert
  with check (auth.uid() is not null);

-- ---- profiles ----
create policy "Users can view profiles in their household"
  on public.profiles for select
  using (household_id = public.my_household_id() or id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- ---- chores ----
create policy "Household members can view chores"
  on public.chores for select
  using (household_id = public.my_household_id());

create policy "Household members can insert chores"
  on public.chores for insert
  with check (household_id = public.my_household_id());

create policy "Household members can update chores"
  on public.chores for update
  using (household_id = public.my_household_id());

create policy "Household members can delete chores"
  on public.chores for delete
  using (household_id = public.my_household_id());

-- ---- maintenance_items ----
create policy "Household members can view maintenance"
  on public.maintenance_items for select
  using (household_id = public.my_household_id());

create policy "Household members can insert maintenance"
  on public.maintenance_items for insert
  with check (household_id = public.my_household_id());

create policy "Household members can update maintenance"
  on public.maintenance_items for update
  using (household_id = public.my_household_id());

create policy "Household members can delete maintenance"
  on public.maintenance_items for delete
  using (household_id = public.my_household_id());

-- ---- budget_accounts ----
create policy "Household members can view accounts"
  on public.budget_accounts for select
  using (household_id = public.my_household_id());

create policy "Household members can insert accounts"
  on public.budget_accounts for insert
  with check (household_id = public.my_household_id());

create policy "Household members can update accounts"
  on public.budget_accounts for update
  using (household_id = public.my_household_id());

create policy "Household members can delete accounts"
  on public.budget_accounts for delete
  using (household_id = public.my_household_id());

-- ---- budget_transactions ----
create policy "Household members can view transactions"
  on public.budget_transactions for select
  using (household_id = public.my_household_id());

create policy "Household members can insert transactions"
  on public.budget_transactions for insert
  with check (household_id = public.my_household_id());

create policy "Household members can update transactions"
  on public.budget_transactions for update
  using (household_id = public.my_household_id());

create policy "Household members can delete transactions"
  on public.budget_transactions for delete
  using (household_id = public.my_household_id());

-- ---- budget_categories ----
create policy "Household members can view categories"
  on public.budget_categories for select
  using (household_id = public.my_household_id());

create policy "Household members can insert categories"
  on public.budget_categories for insert
  with check (household_id = public.my_household_id());

create policy "Household members can update categories"
  on public.budget_categories for update
  using (household_id = public.my_household_id());

create policy "Household members can delete categories"
  on public.budget_categories for delete
  using (household_id = public.my_household_id());

-- ---- recipes ----
create policy "Household members can view recipes"
  on public.recipes for select
  using (household_id = public.my_household_id());

create policy "Household members can insert recipes"
  on public.recipes for insert
  with check (household_id = public.my_household_id());

create policy "Household members can update recipes"
  on public.recipes for update
  using (household_id = public.my_household_id());

create policy "Household members can delete recipes"
  on public.recipes for delete
  using (household_id = public.my_household_id());

-- ---- meal_plan ----
create policy "Household members can view meal plan"
  on public.meal_plan for select
  using (household_id = public.my_household_id());

create policy "Household members can insert meal plan"
  on public.meal_plan for insert
  with check (household_id = public.my_household_id());

create policy "Household members can update meal plan"
  on public.meal_plan for update
  using (household_id = public.my_household_id());

create policy "Household members can delete meal plan"
  on public.meal_plan for delete
  using (household_id = public.my_household_id());

-- ============================================================
-- STORAGE BUCKETS (run separately in Supabase dashboard or CLI)
-- ============================================================
-- supabase storage create avatars --public
-- supabase storage create recipe-images --public

-- ============================================================
-- SEED: Default budget categories
-- ============================================================
-- (These are inserted per-household at household creation time in the app)
-- Example categories a household might use:
--   Housing, Food & Dining, Transportation, Healthcare,
--   Entertainment, Shopping, Utilities, Income
