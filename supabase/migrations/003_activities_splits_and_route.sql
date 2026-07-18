-- Per-km splits and (downsampled) GPS route for in-app recorded runs.
alter table public.activities add column if not exists splits jsonb;
alter table public.activities add column if not exists route jsonb;
comment on column public.activities.splits is 'Array of per-km times in seconds, e.g. [312, 305, ...]';
comment on column public.activities.route is 'Downsampled GPS path: array of [lat, lng] pairs';
