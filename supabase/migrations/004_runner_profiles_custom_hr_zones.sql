-- User-defined heart-rate zones (override the auto-estimated ones).
alter table public.runner_profiles add column if not exists max_hr int;
alter table public.runner_profiles add column if not exists hr_zones jsonb;
comment on column public.runner_profiles.max_hr is 'User-set maximum heart rate (bpm); null = estimate from activities';
comment on column public.runner_profiles.hr_zones is 'Custom zone upper bounds [z1,z2,z3,z4] in bpm (Z5 tops out at max_hr); null = percent-of-max defaults';
