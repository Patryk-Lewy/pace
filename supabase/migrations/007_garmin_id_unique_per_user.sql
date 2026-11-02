-- Scope the Garmin dedup key per user: the same Garmin account linked to two
-- PACE accounts must not block the second user's import (global unique did).
drop index if exists public.activities_garmin_id_key;
create unique index if not exists activities_garmin_id_user_key
  on public.activities(user_id, garmin_id) where garmin_id is not null;
