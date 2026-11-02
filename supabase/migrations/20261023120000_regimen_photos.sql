-- Photos of the product on a regimen (same Photo shape as an entry's; encrypted in health-media). Applied to the live database on 2026-10-23.
alter table health.regimens add column if not exists photos jsonb not null default '[]'::jsonb;
