-- cfe_metric_gauges / cfe_scam_reports / cfe_hitl_queue
--
-- These three tables are already written to by the bot (src/metrics.ts and
-- src/recorder.ts) but had no migration — the inserts have been silently
-- erroring on the remote DB. This migration lands the schema the bot already
-- assumes. All shapes match the columns the dashboard selects at
-- BoT dashboard/backend/main.ts:108,110,111.

-- ─── gauges ────────────────────────────────────────────────────────────────
-- Write: src/metrics.ts:170  .upsert({name, value, updated_at}, onConflict:"name")
-- Read : backend/main.ts:108 select name,value
--
-- The dashboard also writes `agents_online` here (operator presence — the bot
-- has no visibility into it). Both writers upsert by name.
create table if not exists cfe_metric_gauges (
  name        text primary key,
  value       numeric     not null default 0,
  updated_at  timestamptz not null default now()
);

-- ─── scam reports ──────────────────────────────────────────────────────────
-- Write: src/recorder.ts:133 insert {id, entity, flags, risk, status}
-- Read : backend/main.ts:110 select id,entity,flags,risk,status order by created_at desc
create table if not exists cfe_scam_reports (
  id         text primary key,
  entity     text not null,
  flags      text not null default '',
  risk       text not null check (risk in ('high','medium','low')),
  status     text not null default 'awaiting',
  created_at timestamptz not null default now()
);
create index if not exists cfe_scam_reports_created_at_idx on cfe_scam_reports (created_at desc);
create index if not exists cfe_scam_reports_status_idx     on cfe_scam_reports (status);

-- ─── HITL queue ────────────────────────────────────────────────────────────
-- Write: src/recorder.ts:165 insert {id, kind, tag, title, sub, sla_label, status}
-- Read : backend/main.ts:111 select id,kind,tag,title,sub,sla_label,status,created_at
--        where status in ('open','claimed') order by created_at asc
--
-- NOTE: `kind` is intentionally NOT check-constrained. The bot currently emits
-- "escalation"|"approval"|"retry" while the dashboard adapter splits panels by
-- "scam"|"ai"|"human". That drift is a code-level issue to reconcile separately;
-- the DB stays permissive so new kinds can land without a migration.
create table if not exists cfe_hitl_queue (
  id         text primary key,
  kind       text not null,
  tag        text not null,
  title      text not null,
  sub        text not null default '',
  sla_label  text,
  status     text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists cfe_hitl_queue_status_created_idx on cfe_hitl_queue (status, created_at);
create index if not exists cfe_hitl_queue_kind_idx           on cfe_hitl_queue (kind);

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Same posture as the rest of cfe_*: RLS on, service role bypasses, no anon
-- policy (dashboard currently reads via service-role key).
alter table cfe_metric_gauges enable row level security;
alter table cfe_scam_reports  enable row level security;
alter table cfe_hitl_queue    enable row level security;
