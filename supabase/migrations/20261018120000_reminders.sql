-- Reminders: set in the web app or the phone app, delivered by the phone as local notifications
-- (no push server). What a reminder points at is a loose reference (target_kind + target_id) so a
-- deleted target simply leaves the reminder inert; the phone skips reminders whose target is gone.
create table health.reminders (
  id           text primary key,
  owner        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null default '',
  target_kind  text not null default 'custom' check (target_kind in ('custom','challenge','concern','regimen','quick')),
  target_id    text,
  -- {repeat:'daily'|'weekly'|'monthly'|'once', time:'HH:MM', days:[1..7 ISO, Mon=1], monthday:1..28, date:'YYYY-MM-DD'}
  schedule     jsonb not null default '{}',
  private      boolean not null default false,  -- lock screen shows a generic line instead of the title
  skip_if_done boolean not null default true,   -- don't fire if the target is already done for that day
  enabled      boolean not null default true,
  updated_at   timestamptz not null default now()
);
alter table health.reminders enable row level security;
create policy "owner only" on health.reminders for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "two-step when enrolled" on health.reminders as restrictive for all to authenticated
  using ((select health_private.mfa_satisfied())) with check ((select health_private.mfa_satisfied()));
grant select, insert, update, delete on health.reminders to authenticated;
create trigger touch_reminders before update on health.reminders for each row execute function health.touch_updated_at();
