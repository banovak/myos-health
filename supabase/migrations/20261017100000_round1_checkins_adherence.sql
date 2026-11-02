-- Round 1: check-in plans, adherence logging, dose history, measure kinds.
-- Additive only: new columns with defaults, one new table. No existing data changes.

-- measures can be numbers, 1–5 ratings, times of day, or durations
alter table health.metrics add column if not exists kind text not null default 'number'
  check (kind in ('number','rating','time','time_night','duration'));
update health.metrics set kind = 'rating' where is_rating and kind = 'number';

-- a concern can carry a check-in plan: which measures, how often
alter table health.concerns add column if not exists tracking jsonb not null default '{}';

-- regimens: activity kind, a target (e.g. 2 per week), how a session counts as done
-- (ticked by hand, or matched from an integration later), and dose/frequency history
alter table health.regimens drop constraint if exists regimens_category_check;
alter table health.regimens add constraint regimens_category_check
  check (category in ('supplement','medication','skin','hair','activity','other','diet'));
alter table health.regimens add column if not exists target  jsonb;
alter table health.regimens add column if not exists match   jsonb not null default '{"source":"manual"}';
alter table health.regimens add column if not exists changes jsonb not null default '[]';

-- one row per time a regimen was actually done or taken
create table health.regimen_logs (
  id          text primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  regimen_id  text not null references health.regimens(id) on delete cascade,
  on_date     date not null,
  at_time     text,
  source      text not null default 'manual',
  source_ref  text,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  unique (owner, source, source_ref)
);
create index regimen_logs_regimen on health.regimen_logs (owner, regimen_id, on_date);
alter table health.regimen_logs enable row level security;
create policy "owner only" on health.regimen_logs for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "two-step when enrolled" on health.regimen_logs as restrictive for all to authenticated
  using ((select health_private.mfa_satisfied())) with check ((select health_private.mfa_satisfied()));
grant select, insert, update, delete on health.regimen_logs to authenticated;
