-- CFE.Wekeza bot — core persistence (sessions + metrics).
--
-- Run this ONCE against the new Supabase project the CFE bot will use. The
-- bot uses the service role key for writes; the dashboard uses the anon
-- (publishable) key for reads via the policies below.
--
-- Tables:
--   cfe_sessions          — one row per WhatsApp user (upsert on every turn)
--   cfe_metric_counters   — daily rollups (day, name, labels) → bigint value
--   cfe_metric_uniques    — daily set membership (day, set_name, user_id)
--                           so the dashboard can compute true distinct
--                           counts over any date range (COUNT DISTINCT)
--
-- RPCs:
--   cfe_metric_inc(day, name, labels, by) — atomic counter upsert
--   cfe_cleanup_old_data()                — call from pg_cron for TTL
--
-- Everything is prefixed cfe_ so this never collides with other apps that
-- happen to share the project.

create extension if not exists pgcrypto;

-- ─── sessions ───────────────────────────────────────────────────────────────
create table if not exists cfe_sessions (
  user_id text primary key,
  lang text,                        -- "en" | "sw" | null
  mode text,                        -- education | onboarding | simulation | ask | consumer | null
  state text not null default 'new',
  level_id text,
  academy_id text,
  module_id text,
  lesson_idx int not null default 0,
  screen_idx int not null default 0,
  quiz_idx int not null default 0,
  score int not null default 0,
  quiz_pick jsonb not null default '[]'::jsonb,
  quiz_streak int not null default 0,
  quiz_wrong jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  last_lead_scheme text,
  updated_at timestamptz not null default now()
);

-- Indices for dashboard reads: "active users last Nd", "sessions by mode", etc.
create index if not exists cfe_sessions_updated_at_idx on cfe_sessions (updated_at desc);
create index if not exists cfe_sessions_mode_idx on cfe_sessions (mode) where mode is not null;
create index if not exists cfe_sessions_lang_idx on cfe_sessions (lang) where lang is not null;
create index if not exists cfe_sessions_module_idx on cfe_sessions (module_id) where module_id is not null;

-- ─── metric counters (daily rollups) ────────────────────────────────────────
create table if not exists cfe_metric_counters (
  day date not null,
  name text not null,
  labels jsonb not null default '{}'::jsonb,
  value bigint not null default 0,
  primary key (day, name, labels)
);
create index if not exists cfe_metric_counters_day_name_idx on cfe_metric_counters (day, name);
create index if not exists cfe_metric_counters_name_idx on cfe_metric_counters (name);

-- Atomic counter upsert — called from the bot's hot path. Writes amount to the
-- counter and returns nothing. Safe under concurrent calls via UPSERT.
create or replace function cfe_metric_inc(
  _day date,
  _name text,
  _labels jsonb,
  _by bigint
) returns void
language sql
security definer
set search_path = public
as $$
  insert into cfe_metric_counters (day, name, labels, value)
  values (_day, _name, coalesce(_labels, '{}'::jsonb), _by)
  on conflict (day, name, labels) do update
    set value = cfe_metric_counters.value + excluded.value;
$$;

-- ─── metric uniques (daily set membership) ──────────────────────────────────
-- One row per (day, set, user). Dashboard computes rolling 1/7/30-day
-- distinct user counts via COUNT(DISTINCT user_id) across the date range.
create table if not exists cfe_metric_uniques (
  day date not null,
  set_name text not null,
  user_id text not null,
  first_seen timestamptz not null default now(),
  primary key (day, set_name, user_id)
);
create index if not exists cfe_metric_uniques_set_day_idx on cfe_metric_uniques (set_name, day);

-- Fire-and-forget add. Returns true if a new row was inserted, false if the
-- user was already in the set for the day. Bot uses this for the "new user
-- today" counter.
create or replace function cfe_metric_add_unique(
  _day date,
  _set text,
  _user text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted boolean;
begin
  insert into cfe_metric_uniques (day, set_name, user_id)
  values (_day, _set, _user)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- ─── TTL cleanup (schedule from pg_cron if available) ───────────────────────
create or replace function cfe_cleanup_old_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from cfe_sessions         where updated_at < now() - interval '30 days';
  delete from cfe_metric_uniques   where day < current_date - interval '400 days';
  delete from cfe_metric_counters  where day < current_date - interval '400 days';
$$;

-- ─── RLS: service role writes, anon reads for the dashboard ─────────────────
alter table cfe_sessions         enable row level security;
alter table cfe_metric_counters  enable row level security;
alter table cfe_metric_uniques   enable row level security;

-- Service role bypasses RLS automatically (used by the bot).
-- Anon (publishable) key is used by the dashboard — read-only on metrics
-- (counters, uniques). Sessions remain private: no anon policy means no
-- anon access.
drop policy if exists "anon read counters" on cfe_metric_counters;
create policy "anon read counters"
  on cfe_metric_counters for select
  to anon
  using (true);

drop policy if exists "anon read uniques" on cfe_metric_uniques;
create policy "anon read uniques"
  on cfe_metric_uniques for select
  to anon
  using (true);

-- Grant execute on the dashboard-safe read helpers (not the write ones).
revoke all on function cfe_metric_inc(date, text, jsonb, bigint) from anon;
revoke all on function cfe_metric_add_unique(date, text, text) from anon;
revoke all on function cfe_cleanup_old_data() from anon;
