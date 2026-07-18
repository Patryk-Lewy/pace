-- plan_goals was created in the initial schema but never used by the app
-- (zero code references, zero rows). Goals live in runner_profiles instead.
drop table if exists public.plan_goals;
