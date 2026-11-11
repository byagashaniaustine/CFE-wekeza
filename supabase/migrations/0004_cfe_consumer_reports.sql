-- cfe_consumer_reports — one row per complaint a user files via the bot.
--
-- Write side : src/recorder.ts  recordConsumerReport()  (service-role insert)
-- Read  side : BoT dashboard — ops picks these up and follows up on WhatsApp
--              using user_id. The dashboard owns the status transitions after
--              the row lands (awaiting_fsp → awaiting_bot → under_review → resolved).
--
-- Flow context. The bot only accepts "awaiting_bot" submissions — meaning the
-- user confirmed (1) they already contacted their FSP and (2) at least 14 days
-- have passed without a resolution. Both are BoT's own gating requirements for
-- an escalated complaint (fetched from bot.go.tz/DFDI/ConsumerProtection) and
-- captured in session state before this row is written.

create table if not exists cfe_consumer_reports (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  user_id           text        not null,       -- WhatsApp sender id; dashboard uses this to reply
  lang              text        check (lang in ('en','sw')),
  fsp_name          text        not null,       -- which bank / MNO / microfinance
  issue             text        not null,       -- short free-text description
  fsp_response      text        not null default '',  -- what FSP said, or "no response"
  fsp_contacted     boolean     not null default true, -- always true at write time (bot gates it)
  days_since_fsp    integer,                    -- user's own answer (>=14 or NULL if not asked)
  status            text        not null default 'awaiting_bot'
                      check (status in ('awaiting_bot','under_review','resolved','rejected')),
  resolution_note   text        not null default ''  -- dashboard fills this in on close
);

create index if not exists cfe_consumer_reports_created_at_idx on cfe_consumer_reports (created_at desc);
create index if not exists cfe_consumer_reports_status_idx     on cfe_consumer_reports (status);
create index if not exists cfe_consumer_reports_user_idx       on cfe_consumer_reports (user_id);

-- RLS on. Rows carry user-submitted complaint content and a WhatsApp id, so no
-- anon read policy. Bot writes with service role; dashboard reads with service
-- role today. If the dashboard ever moves to anon, add a scoped view that masks
-- user_id rather than opening this table.
alter table cfe_consumer_reports enable row level security;

-- cfe_sessions: in-progress BoT complaint draft. jsonb so {fspName, issue,
-- fspResponse} round-trips via supabase-js without extra columns. Cleared on
-- submit or any mode switch; a non-null value means the user has a partial
-- draft and may be mid-flow across multiple WhatsApp turns.
alter table cfe_sessions add column if not exists report_draft jsonb;
