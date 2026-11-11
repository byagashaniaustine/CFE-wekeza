// Application-level recorders backed by Supabase.
//
// Where metrics.ts owns aggregated counters/uniques, this module owns row-per-
// event records that back the dashboard's "live" panels:
//   • cfe_ai_log       — one row per user-facing LLM turn
//   • cfe_scam_reports — one row per scanned message that scored medium/high
//   • cfe_hitl_queue   — human-in-the-loop queue (scam triage, LLM outage, …)
//
// Shared pattern (mirrors metrics.ts):
//   • Writes are fire-and-forget via queueMicrotask — never block the reply.
//   • Errors are swallowed (logged to stdout as WARN) so a Supabase outage
//     never crashes the bot.
//   • If SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are unset, writes land in
//     an in-memory ring buffer (tests + local dev without creds).
//   • Hot-path safe: redact phone numbers out of `input` before it leaves
//     the bot process; we never persist raw PII to the DB.

import type { Lang } from "./content.ts";
import { getSupabase } from "./supabase.ts";

const writesEnabled = () =>
  (Deno.env.get("RECORDER_ENABLED") ?? "on").toLowerCase() !== "off";

// Tanzanian phone patterns: local (0744…, 0655…) + international (+2557…).
// Order matters — match international first so the `+` doesn't get swallowed.
const PHONE_RE = /(\+?2557\d{8}|0[67]\d{7,8})/g;

/** Replace Tanzanian phone numbers in `s` with `[phone]`. Returns the cleaned
 *  string and a flag indicating whether anything was stripped. */
export function redactPhone(s: string): { text: string; didRedact: boolean } {
  let didRedact = false;
  const text = s.replace(PHONE_RE, () => {
    didRedact = true;
    return "[phone]";
  });
  return { text, didRedact };
}

// ── in-memory fallback ─────────────────────────────────────────────────────
interface MemoryStore {
  ai: Array<Record<string, unknown>>;
  scams: Array<Record<string, unknown>>;
  hitl: Array<Record<string, unknown>>;
  reports: Array<Record<string, unknown>>;
}
const memory: MemoryStore = { ai: [], scams: [], hitl: [], reports: [] };

function fire(op: () => Promise<unknown>): void {
  if (!writesEnabled()) return;
  queueMicrotask(() => {
    op().catch((err) => {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        category: "WARN",
        step: "recorder.write",
        error: String((err as Error)?.message ?? err),
      }));
    });
  });
}

function newId(prefix: string): string {
  // No external uuid dep — a timestamp + random suffix is unique enough for
  // dashboard rows that only need "first 8 chars" uniqueness.
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}_${t}${r}`;
}

// ── cfe_ai_log ─────────────────────────────────────────────────────────────

export type AiAction = "auto" | "escalated" | "blocked" | "template";
export type AiProvider = "claude" | "gemini";

export interface AiTurn {
  userId: string;
  lang: Lang | null;
  intent?: string;              // short tag ("qa", "classify", …); dashboard shows as text
  input: string;                // RAW user input — redactPhone() is applied here
  output: string;               // model reply (empty string if nothing sent)
  confidence?: number | null;   // 0..1 — null if we don't know
  action?: AiAction;            // default "auto"
  provider?: AiProvider;        // which provider actually answered
  latencyMs?: number;           // LLM round-trip ms
  handleLatencyMs?: number | null; // end-to-end turn ms (null if unknown)
}

export function recordAiTurn(t: AiTurn): void {
  const redacted = redactPhone(t.input ?? "");
  const row = {
    user_id: t.userId,
    lang: t.lang,
    intent: t.intent ?? "qa",
    input: redacted.text,
    output: t.output ?? "",
    confidence: t.confidence ?? null,
    action: t.action ?? "auto",
    provider: t.provider ?? null,
    latency_ms: t.latencyMs == null ? null : Math.round(t.latencyMs),
    handle_latency_ms: t.handleLatencyMs == null ? null : Math.round(t.handleLatencyMs),
    redact_phone: redacted.didRedact,
  };
  fire(async () => {
    const sb = getSupabase();
    if (!sb) { memory.ai.push(row); return; }
    const { error } = await sb.from("cfe_ai_log").insert(row);
    if (error) throw error;
  });
}

// ── cfe_scam_reports ───────────────────────────────────────────────────────

export type ScamRisk = "high" | "medium" | "low";

export interface ScamReport {
  entity: string;              // provider name if known, else short input hint
  flags: string[];             // list of flag codes (compact comma-joined on write)
  risk: ScamRisk;              // high | medium | low
}

export function recordScamReport(r: ScamReport): string {
  const id = newId("scam");
  const row = {
    id,
    entity: r.entity.slice(0, 120),
    flags: r.flags.join(","),
    risk: r.risk,
    status: "awaiting",
  };
  fire(async () => {
    const sb = getSupabase();
    if (!sb) { memory.scams.push(row); return; }
    const { error } = await sb.from("cfe_scam_reports").insert(row);
    if (error) throw error;
  });
  return id;
}

// ── cfe_hitl_queue ─────────────────────────────────────────────────────────

export type HitlKind = "escalation" | "approval" | "retry";

export interface HitlItem {
  kind: HitlKind;
  tag: string;
  title: string;
  sub?: string;
  slaLabel?: string;
}

export function recordHitl(it: HitlItem): string {
  const id = newId("hitl");
  const row = {
    id,
    kind: it.kind,
    tag: it.tag.slice(0, 40),
    title: it.title.slice(0, 200),
    sub: (it.sub ?? "").slice(0, 300),
    sla_label: it.slaLabel ?? null,
    status: "open",
  };
  fire(async () => {
    const sb = getSupabase();
    if (!sb) { memory.hitl.push(row); return; }
    const { error } = await sb.from("cfe_hitl_queue").insert(row);
    if (error) throw error;
  });
  return id;
}

// ── cfe_consumer_reports ───────────────────────────────────────────────────
//
// A complaint the user chose to escalate to BoT via the bot. The bot writes
// here ONLY after confirming the user's FSP-first step (contacted their bank
// / MNO / microfinance) AND the 14-day BoT waiting window has elapsed —
// those are BoT's own gating requirements. The dashboard owns status
// transitions after the row lands (awaiting_bot → under_review → resolved).

export interface ConsumerReport {
  userId: string;
  lang: Lang | null;
  fspName: string;        // which FSP the user is complaining about
  issue: string;          // short free-text description
  fspResponse: string;    // what the FSP said, or "no response"
  daysSinceFsp?: number;  // user's own answer; >=14 at write time
}

export function recordConsumerReport(r: ConsumerReport): string {
  const id = newId("report");
  const issue = redactPhone(r.issue ?? "");
  const response = redactPhone(r.fspResponse ?? "");
  const row = {
    id,
    user_id: r.userId,
    lang: r.lang,
    fsp_name: r.fspName.slice(0, 120),
    issue: issue.text.slice(0, 1000),
    fsp_response: response.text.slice(0, 1000),
    fsp_contacted: true,
    days_since_fsp: r.daysSinceFsp ?? null,
    status: "awaiting_bot",
  };
  fire(async () => {
    const sb = getSupabase();
    if (!sb) { memory.reports.push(row); return; }
    const { error } = await sb.from("cfe_consumer_reports").insert(row);
    if (error) throw error;
  });
  return id;
}

// ── test helpers ───────────────────────────────────────────────────────────

export function _snapshotForTests(): MemoryStore {
  return {
    ai: [...memory.ai],
    scams: [...memory.scams],
    hitl: [...memory.hitl],
    reports: [...memory.reports],
  };
}

export function _resetForTests(): void {
  memory.ai.length = 0;
  memory.scams.length = 0;
  memory.hitl.length = 0;
  memory.reports.length = 0;
}

export async function _flushForTests(): Promise<void> {
  await new Promise<void>((r) => queueMicrotask(() => r()));
  await new Promise<void>((r) => queueMicrotask(() => r()));
}
