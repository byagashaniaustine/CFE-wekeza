-- cfe_audit / cfe_directory / cfe_broadcasts / cfe_broadcast_templates
--
-- The dashboard reads these four tables (BoT dashboard/backend/main.ts:113-116)
-- but nothing in the ecosystem writes them yet — the bot has no writers, and
-- the dashboard's writer flows (operator actions, broadcast proposals, directory
-- maintenance) land here. Previously the dashboard was silently 404-ing on all
-- four and degrading to empty panels, hiding the gap.
--
-- Column shapes mirror the row types in backend/main.ts:83-87 exactly.

-- ─── audit ─────────────────────────────────────────────────────────────────
-- Operator actions and system-level events that need an immutable trail.
-- Dashboard selects id,created_at,user_id,action,entity,detail desc.
create table if not exists cfe_audit (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  user_id    text        not null,
  action     text        not null,
  entity     text        not null,
  detail     text        not null default ''
);
create index if not exists cfe_audit_created_at_idx on cfe_audit (created_at desc);
create index if not exists cfe_audit_user_id_idx    on cfe_audit (user_id);

-- ─── directory ─────────────────────────────────────────────────────────────
-- Known entities (FSPs, scheme promoters, flagged brands). Status/reason drive
-- the "blocked / under review / approved" labelling in the dashboard panel.
create table if not exists cfe_directory (
  id        text primary key,
  name      text not null,
  aka       text not null default '',
  category  text not null,
  regulator text,
  status    text not null,
  reason    text not null default ''
);
create index if not exists cfe_directory_name_idx   on cfe_directory (name);
create index if not exists cfe_directory_status_idx on cfe_directory (status);

-- ─── broadcasts ────────────────────────────────────────────────────────────
-- Outbound broadcast proposals authored in the dashboard, approved by an
-- operator, dispatched by a sender worker.
create table if not exists cfe_broadcasts (
  id          text primary key,
  title       text not null,
  audience    text not null,
  lang        text not null,
  template    text,
  body        text not null,
  status      text not null,
  proposed_by text not null,
  created_at  timestamptz not null default now()
);
create index if not exists cfe_broadcasts_status_idx     on cfe_broadcasts (status);
create index if not exists cfe_broadcasts_created_at_idx on cfe_broadcasts (created_at desc);

-- ─── broadcast templates ───────────────────────────────────────────────────
-- Approved Meta/WhatsApp template names the operator can pick from when
-- composing a broadcast. One row per template.
create table if not exists cfe_broadcast_templates (
  name text primary key
);

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table cfe_audit               enable row level security;
alter table cfe_directory           enable row level security;
alter table cfe_broadcasts          enable row level security;
alter table cfe_broadcast_templates enable row level security;
