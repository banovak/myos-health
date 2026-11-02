-- Stints: a regimen or diet stopped and started again is one record. Present only when there is more than one stint. Applied to the live database on 2026-10-24.
alter table health.regimens add column if not exists periods jsonb not null default '[]'::jsonb;
