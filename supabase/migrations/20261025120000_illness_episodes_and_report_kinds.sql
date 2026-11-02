-- Illnesses: a concern with kind = 'illness' comes in episodes; any concern may carry a colour.
-- Reports: lab_reports widened to prescriptions, scans and letters (kind), with a title. Applied to the live database on 2026-10-25.
alter table health.concerns
  add column if not exists kind text,
  add column if not exists episodes jsonb not null default '[]'::jsonb,
  add column if not exists color text;
alter table health.lab_reports
  add column if not exists kind text,
  add column if not exists title text;
