-- My OS: Health — health schema.
-- Everything lives in its own `health` schema so the same Supabase project can hold
-- other personal data. Single-user by design: every row carries `owner` and every
-- table is locked to owner = auth.uid(). Nothing is readable by anon.

create schema if not exists health;
grant usage on schema health to authenticated;

create or replace function health.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- one row per user: body photo, points, layout and preferences
create table health.profile (
  owner          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  base_photo     jsonb,                                   -- { path } in health-media
  points         jsonb not null default '[]',
  custom_regions jsonb not null default '{}',
  widgets        jsonb,
  chart_layout   text  not null default 'top',
  chart_zones    jsonb,
  settings       jsonb not null default '{}',
  updated_at     timestamptz not null default now()
);

-- user-defined measurement list (weight, hair density rating, 5k time…)
create table health.metrics (
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key        text not null,
  label      text not null,
  unit       text not null default '',
  is_rating  boolean not null default false,
  sort_order int not null default 0,
  primary key (owner, key)
);

create table health.concerns (
  id          text primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  regions     text[] not null default '{}',
  started_on  date,
  resolved_on date,
  status      text not null default 'active' check (status in ('active','resolved','recurring')),
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- things that happen on a date
create table health.entries (
  id              text primary key,
  owner           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_at     date not null,
  type            text not null check (type in ('photo','appointment','measurement','procedure','observation')),
  title           text not null,
  notes           text not null default '',
  regions         text[] not null default '{}',
  concern_id      text references health.concerns(id) on delete set null,
  parent_entry_id text references health.entries(id) on delete set null,
  details         jsonb not null default '{}',
  source          text not null default 'manual',
  photos          jsonb not null default '[]',           -- [{ path }] in health-media
  files           jsonb not null default '[]',           -- [{ path, name, size }]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index entries_owner_date on health.entries (owner, occurred_at desc);
create index entries_owner_type on health.entries (owner, type);
create index entries_metric on health.entries ((details->>'metric')) where type = 'measurement';

-- things that run over time: supplements, meds, products, diets
create table health.regimens (
  id          text primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  category    text not null check (category in ('supplement','medication','skin','hair','other','diet')),
  dose        text not null default '',
  frequency   text not null default '',
  started_on  date not null,
  ended_on    date,
  regions     text[] not null default '{}',
  concern_id  text references health.concerns(id) on delete set null,
  color       text,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);

create table health.challenges (
  id          text primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  started_on  date not null,
  days        int  not null check (days > 0),
  regimen_ids text[] not null default '{}',
  rules       jsonb not null default '[]',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- labs: a report and its results as rows, so any new lab just adds rows
create table health.lab_reports (
  id           text primary key,
  owner        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collected_on date not null,
  lab          text not null default '',
  file         jsonb,                                     -- { path, name } of the PDF
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create table health.lab_results (
  id         text primary key,
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_id  text not null references health.lab_reports(id) on delete cascade,
  marker     text not null,
  value      numeric not null,
  unit       text not null default '',
  range_text text not null default '',                    -- as printed by the lab
  flag_text  text not null default '',                    -- as printed by the lab
  sort_order int  not null default 0
);
create index lab_results_marker on health.lab_results (owner, marker);
-- maps each lab's naming to one marker so different labs chart as one line
create table health.lab_markers (
  owner          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key            text not null,
  label          text not null,
  canonical_unit text not null default '',
  aliases        text[] not null default '{}',
  unit_factors   jsonb not null default '{}',
  primary key (owner, key)
);

-- appointments: yearly plan items and courses of care
create table health.plans (
  id         text primary key,
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year       int  not null,
  title      text not null,
  kind       text not null default 'doctor',
  per_year   int  not null default 1 check (per_year > 0),
  notes      text not null default '',
  sort_order int  not null default 0
);
create table health.courses (
  id          text primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  kind        text not null default 'physio',
  provider    text not null default '',
  practice    text not null default '',
  cadence     text not null default '',
  started_on  date not null,
  ended_on    date,
  concern_id  text references health.concerns(id) on delete set null,
  metric      text,
  cost        numeric,
  color       text,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- saved charts (config mirrors the chart builder)
create table health.charts (
  id         text primary key,
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null default '',
  config     jsonb not null default '{}',
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Apple Health / Oura daily aggregates (filled by the My OS app later)
create table health.daily_metrics (
  owner   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  on_date date not null,
  source  text not null,
  key     text not null,
  value   numeric not null,
  primary key (owner, on_date, source, key)
);

-- calendar suggestions: written by a narrow function later, accepted or dismissed in the app
create table health.suggestions (
  id          text primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source      text not null default 'calendar',
  source_ref  text,
  title       text not null,
  occurred_at date not null,
  details     jsonb not null default '{}',
  found       text not null default '',
  status      text not null default 'pending' check (status in ('pending','accepted','dismissed')),
  created_at  timestamptz not null default now(),
  unique (owner, source, source_ref)
);

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['profile','concerns','entries','regimens','challenges','lab_reports','courses','charts'] loop
    execute format('create trigger touch_%1$s before update on health.%1$I for each row execute function health.touch_updated_at()', t);
  end loop;
end $$;

-- owner-only access on every table
do $$ declare t text; begin
  foreach t in array array['profile','metrics','concerns','entries','regimens','challenges','lab_reports','lab_results','lab_markers','plans','courses','charts','daily_metrics','suggestions'] loop
    execute format('alter table health.%I enable row level security', t);
    execute format('create policy "owner only" on health.%I for all to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on health.%I to authenticated', t);
  end loop;
end $$;

-- private storage for photos and files: each user writes only under their own folder
insert into storage.buckets (id, name, public, file_size_limit)
values ('health-media', 'health-media', false, 26214400)
on conflict (id) do nothing;

create policy "health-media owner read"   on storage.objects for select to authenticated using (bucket_id = 'health-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "health-media owner insert" on storage.objects for insert to authenticated with check (bucket_id = 'health-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "health-media owner update" on storage.objects for update to authenticated using (bucket_id = 'health-media' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'health-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "health-media owner delete" on storage.objects for delete to authenticated using (bucket_id = 'health-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
