-- Garmin Personal API: per-user key + cached 24h access token.
create table if not exists public.garmin_tokens (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  api_key          text not null,
  access_token     text,
  token_expires_at bigint,
  last_sync        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.garmin_tokens enable row level security;

create policy "Users manage own garmin tokens"
  on public.garmin_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Dedup key for imported Garmin runs (multiple NULLs allowed for Strava/manual).
alter table public.activities add column if not exists garmin_id bigint;
create unique index if not exists activities_garmin_id_key
  on public.activities(garmin_id) where garmin_id is not null;
