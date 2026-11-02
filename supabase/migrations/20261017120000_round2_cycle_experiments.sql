-- Round 2: cycle tracking, experiments, food trials. Additive only.

-- food trials are a new kind of dated entry
alter table health.entries drop constraint if exists entries_type_check;
alter table health.entries add constraint entries_type_check
  check (type in ('photo','appointment','measurement','procedure','observation','food_trial'));

-- experiments: the challenges table gains a kind (challenge | phases | before_after)
-- and a config for the kind-specific settings; only challenges need a length in days
alter table health.challenges add column if not exists kind text not null default 'challenge'
  check (kind in ('challenge','phases','before_after'));
alter table health.challenges add column if not exists config jsonb not null default '{}';
alter table health.challenges alter column days drop not null;

-- cycle tracking: one row per day per source. Manual logging uses source 'manual';
-- a period app syncing through Apple Health (Clue, Flo, Natural Cycles, Oura…) lands as
-- source 'apple_health' with the sample id in source_ref, so re-syncs never duplicate
-- and never overwrite what was typed by hand.
create table health.cycle_days (
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  on_date    date not null,
  source     text not null default 'manual',
  flow       text not null default 'none' check (flow in ('none','spotting','light','medium','heavy','unspecified')),
  symptoms   text[] not null default '{}',
  note       text not null default '',
  source_ref text,
  updated_at timestamptz not null default now(),
  primary key (owner, on_date, source)
);
alter table health.cycle_days enable row level security;
create policy "owner only" on health.cycle_days for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "two-step when enrolled" on health.cycle_days as restrictive for all to authenticated
  using ((select health_private.mfa_satisfied())) with check ((select health_private.mfa_satisfied()));
grant select, insert, update, delete on health.cycle_days to authenticated;
create trigger touch_cycle_days before update on health.cycle_days for each row execute function health.touch_updated_at();
