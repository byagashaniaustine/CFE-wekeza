-- cfe_ai_log — one row per user-facing LLM turn.
--
-- Write side : src/recorder.ts  recordAiTurn()  (service-role insert, phone-redacted)
-- Read  side : BoT dashboard backend/main.ts  (select over the range, newest first)
--
-- The writer does NOT set id/created_at — they are DB-generated here. All other
-- columns mirror recorder.ts's inserted row exactly.

create table if not exists cfe_ai_log (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  user_id           text,                       -- raw WhatsApp id (not exposed by the dashboard)
  lang              text,                        -- 'en' | 'sw' | null
  intent            text        not null default 'qa',
  input             text        not null default '',  -- phone numbers already redacted to [phone]
  output            text        not null default '',
  confidence        real,                        -- 0..1, null if unknown
  action            text        not null default 'auto'
                      check (action in ('auto','escalated','blocked','template')),
  provider          text        check (provider in ('claude','gemini')),
  latency_ms        integer,                     -- LLM round-trip
  handle_latency_ms integer,                     -- end-to-end turn
  redact_phone      boolean     not null default false
);

-- The dashboard filters `created_at >= since` and orders by created_at desc.
create index if not exists cfe_ai_log_created_at_idx on cfe_ai_log (created_at desc);
create index if not exists cfe_ai_log_action_idx     on cfe_ai_log (action);

-- RLS on. cfe_ai_log carries message content, so there is intentionally NO
-- anon read policy: the bot writes with the service-role key (bypasses RLS) and
-- the dashboard reads with the service-role key today. If/when the dashboard
-- moves to the anon key, add a tightly scoped read policy here (and mask `input`
-- / drop `user_id` via a view) rather than opening the raw table.
alter table cfe_ai_log enable row level security;

-- Retention: keep the AI log bounded (dashboard only needs recent history).
-- Run from a scheduled job (pg_cron) or fold into cfe_cleanup_old_data():
--   delete from cfe_ai_log where created_at < now() - interval '90 days';
