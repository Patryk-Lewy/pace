-- Allow locally-recorded (in-app GPS) runs to live in `activities` alongside
-- Strava imports. Manual runs have no strava_id; the unique index on strava_id
-- still holds because Postgres permits multiple NULLs.
alter table public.activities alter column strava_id drop not null;
alter table public.activities alter column strava_type drop not null;
alter table public.activities add column if not exists source text not null default 'strava';
comment on column public.activities.source is 'Origin of the activity: strava | manual (in-app GPS recording)';
