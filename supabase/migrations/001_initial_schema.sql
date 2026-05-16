-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- RUNNER PROFILES
-- ============================================================
create table public.runner_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Goal
  race_goal    text,                          -- 'Chcę przebiec maraton'
  race_distance text,                         -- '5km' | '10km' | 'half' | 'marathon'
  race_date    date,                          -- Data zawodów

  -- Current fitness
  weekly_km    numeric(5,1),                  -- Tygodniowy kilometraż
  best_5k_pace text,                         -- '5:30' min/km
  available_days text[],                      -- ['mon','wed','fri','sun']
  max_session_minutes int,                    -- 60

  -- Context
  injury_history text,                        -- 'Kolano biegacza (2024)'
  additional_goal text,                       -- 'Schudnąć 5 kg'

  -- Onboarding state
  onboarding_completed boolean not null default false,
  onboarding_step int not null default 0
);

-- ============================================================
-- PLAN GOALS (jeden aktywny cel)
-- ============================================================
create table public.plan_goals (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),

  distance     text not null,                -- 'marathon'
  target_date  date not null,
  target_time  text,                         -- opcjonalnie '4:00:00'
  is_active    boolean not null default true
);

-- ============================================================
-- RLS POLICIES
-- ============================================================
alter table public.runner_profiles enable row level security;
alter table public.plan_goals enable row level security;

-- runner_profiles: każdy widzi tylko swój profil
create policy "Users can view own profile"
  on public.runner_profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.runner_profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.runner_profiles for update
  using (auth.uid() = id);

-- plan_goals
create policy "Users can view own goals"
  on public.plan_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.plan_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.plan_goals for update
  using (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.runner_profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_runner_profiles_updated_at
  before update on public.runner_profiles
  for each row execute procedure public.set_updated_at();
