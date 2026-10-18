// Durable, globally-correct metrics backed by Supabase.
//
// Why Supabase instead of in-process Maps or Deno KV:
//   • Deno Deploy isolates get torn down — in-process Maps lose counters at
//     every cold start and fragment across concurrent isolates.
//   • The dashboard needs to read these counters without an HTTP proxy. One
//     shared Postgres table solves it: bot writes with the service role key,
//     dashboard reads with the anon key via RLS policies.
//   • True distinct-user counts over 7/30-day windows are a plain
//     COUNT DISTINCT in Postgres — Deno KV's atomic counters can't do that.
//
// Storage shape (see supabase/migrations/0001_cfe_bot_core.sql):
//   cfe_metric_counters(day, name, labels jsonb, value bigint)
//   cfe_metric_uniques(day, set_name, user_id)
//   cfe_metric_inc(_day, _name, _labels, _by)  — atomic upsert RPC
//   cfe_metric_add_unique(_day, _set, _user)   — insert-on-conflict RPC
//
// Histograms: fixed log-scaled bucket boundaries baked into observe(). Each
// sample increments bucket + sum + count counters in one RPC batch; snapshot()
// estimates p50/p95/p99 from cumulative bucket counts.
//
// Hot-path safety: every recorder dispatches writes via queueMicrotask and
// swallows errors — a Supabase outage never blocks the bot's reply path. If
// Supabase is unconfigured (local dev), writes land in an in-memory fallback
// and snapshot() still returns something sensible.

import type { Lang } from "./content.ts";
import { getSupabase } from "./supabase.ts";

// ── config ─────────────────────────────────────────────────────────────────
const WRITES_ENABLED = (Deno.env.get("METRICS_ENABLED") ?? "on").toLowerCase() !== "off";

// Fixed histogram buckets (ms). Covers 10ms – 30s. Any sample above the last
// boundary falls into the implicit "inf" bucket.
const BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 30_000] as const;

// ── primitives ─────────────────────────────────────────────────────────────
type Labels = Record<string, string>;

const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10);
const todayUtc = dayKey;

function cleanLabels(labels?: Labels): Record<string, string> {
  if (!labels) return {};
  const out: Record<string, string> = {};
  // Sort by key so the same labels always serialise to the same jsonb payload
  // (Postgres hashes jsonb by content, so sort order doesn't matter for the
  // UNIQUE constraint — but we sort anyway for log consistency).
  const sorted = Object.entries(labels)
    .filter(([_, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of sorted) out[k] = String(v);
  return out;
}

function pickBucket(value: number): string {
  for (const b of BUCKETS_MS) if (value <= b) return String(b);
  return "inf";
}

// ── in-memory fallback (used when SUPABASE_URL unset — local dev + tests) ──
// Shape mirrors the Supabase tables so snapshot() can read it the same way.
interface MemoryStore {
  counters: Map<string, number>; // key = `${day}|${name}|${labelsJson}`
  uniques: Map<string, Set<string>>; // key = `${day}|${setName}`
}
const memory: MemoryStore = { counters: new Map(), uniques: new Map() };
const memKey = (day: string, name: string, labels: Labels) =>
  `${day}|${name}|${JSON.stringify(labels)}`;

function memInc(day: string, name: string, labels: Labels, by: number) {
  const k = memKey(day, name, labels);
  memory.counters.set(k, (memory.counters.get(k) ?? 0) + by);
}
function memAddUnique(day: string, setName: string, user: string): boolean {
  const k = `${day}|${setName}`;
  const s = memory.uniques.get(k) ?? new Set<string>();
  const was = s.size;
  s.add(user);
  memory.uniques.set(k, s);
  return s.size > was;
}

// ── fire-and-forget write dispatcher ───────────────────────────────────────
function fire(op: () => Promise<unknown>): void {
  if (!WRITES_ENABLED) return;
  queueMicrotask(() => {
    op().catch((err) => {
      // Writes must never crash the bot. Log via stdout only — calling log()
      // from here would recurse through metrics itself.
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        category: "WARN",
        step: "metrics.write",
        error: String(err?.message ?? err),
      }));
    });
  });
}

async function supabaseInc(day: string, name: string, labels: Labels, by: number) {
  const sb = getSupabase();
  if (!sb) { memInc(day, name, labels, by); return; }
  const { error } = await sb.rpc("cfe_metric_inc", {
    _day: day,
    _name: name,
    _labels: labels,
    _by: by,
  });
  if (error) throw error;
}

async function supabaseAddUnique(day: string, setName: string, user: string) {
  const sb = getSupabase();
  if (!sb) { memAddUnique(day, setName, user); return; }
  const { error } = await sb.rpc("cfe_metric_add_unique", {
    _day: day,
    _set: setName,
    _user: user,
  });
  if (error) throw error;
}

function inc(name: string, labels?: Labels, by = 1): void {
  const day = dayKey();
  const clean = cleanLabels(labels);
  fire(() => supabaseInc(day, name, clean, by));
}

function observe(name: string, value: number, labels?: Labels): void {
  const day = dayKey();
  const clean = cleanLabels(labels);
  const bucket = pickBucket(value);
  const rounded = Math.round(value);
  fire(async () => {
    await supabaseInc(day, `${name}__bucket`, { ...clean, bucket }, 1);
    await supabaseInc(day, `${name}__sum`, clean, rounded);
    await supabaseInc(day, `${name}__count`, clean, 1);
  });
}

function addUnique(setName: string, id: string): void {
  const day = dayKey();
  fire(() => supabaseAddUnique(day, setName, id));
}

function setGauge(name: string, value: number, labels?: Labels): void {
  // Gauges are a single-row-per-key latest-wins pattern. Rare in this bot
  // (only queueDepth today). Store as a counter with a special name so the
  // snapshot still sees them, and overwrite the value each call via upsert.
  const day = dayKey();
  const clean = cleanLabels(labels);
  fire(async () => {
    const sb = getSupabase();
    if (!sb) { memory.counters.set(memKey(day, `__gauge__${name}`, clean), value); return; }
    const { error } = await sb
      .from("cfe_metric_counters")
      .upsert({ day, name: `__gauge__${name}`, labels: clean, value }, { onConflict: "day,name,labels" });
    if (error) throw error;
  });
}

// ── public recorders — SAME SIGNATURES as previous versions ────────────────

export function messageReceived(userId: string, lang: Lang | null): void {
  inc("messages_received_total", { lang: lang ?? "unknown" });
  addUnique("users_all_time", userId);
  addUnique(`users_daily:${todayUtc()}`, userId);
}

export function messageSent(kind: string, lang: Lang | null): void {
  inc("messages_sent_total", { kind, lang: lang ?? "unknown" });
}

export function newUser(userId: string, lang: Lang | null): void {
  inc("users_new_total", { lang: lang ?? "unknown" });
  addUnique("users_new_all_time", userId);
}

export function languageChosen(lang: Lang): void {
  inc("language_chosen_total", { lang });
}

export type Journey = "learn" | "products" | "quiz" | "ask";
export function journeyEntered(journey: Journey, lang: Lang): void {
  inc("journey_entered_total", { journey, lang });
}
export function levelSelected(levelId: string, lang: Lang): void {
  inc("level_selected_total", { level: levelId, lang });
}
export function academySelected(academyId: string, lang: Lang): void {
  inc("academy_selected_total", { academy: academyId, lang });
}
export function moduleOpened(moduleId: string, lang: Lang, status: "ready" | "coming_soon"): void {
  inc("module_opened_total", { module: moduleId, lang, status });
}
export function moduleCompleted(moduleId: string, lang: Lang): void {
  inc("module_completed_total", { module: moduleId, lang });
}
export function screenAdvance(moduleId: string, lessonIdx: number, screenIdx: number, dir: "next" | "prev"): void {
  inc("screen_nav_total", { module: moduleId, lesson: String(lessonIdx), screen: String(screenIdx), dir });
}

export function quizStarted(lang: Lang): void {
  inc("quiz_started_total", { lang });
}
export function quizAnswer(questionId: string, correct: boolean, lang: Lang): void {
  inc("quiz_answer_total", { question: questionId, correct: String(correct), lang });
}
export function quizCompleted(score: number, total: number, lang: Lang): void {
  inc("quiz_completed_total", { lang });
  observe("quiz_score_pct", total === 0 ? 0 : (score / total) * 100, { lang });
}
export function quizWeakTopic(topic: string, lang: Lang): void {
  inc("quiz_weak_topic_total", { topic, lang });
}

export type LlmProvider = "claude" | "gemini";
export function askQuestion(lang: Lang): void {
  inc("ask_question_total", { lang });
}
export function llmCall(provider: LlmProvider, outcome: "ok" | "error", latencyMs: number, lang: Lang): void {
  inc("llm_call_total", { provider, outcome, lang });
  observe("llm_latency_ms", latencyMs, { provider });
}
export function llmFailover(from: LlmProvider, to: LlmProvider, reason: string): void {
  inc("llm_failover_total", { from, to, reason });
}

export function templateSend(templateName: string, outcome: "ok" | "error", lang: Lang | null): void {
  inc("template_send_total", { template: templateName, outcome, lang: lang ?? "unknown" });
}
export function flowLaunch(moduleId: string, outcome: "ok" | "fallback", lang: Lang): void {
  inc("flow_launch_total", { module: moduleId, outcome, lang });
}
export function mediaUpload(cardKey: string, outcome: "ok" | "error"): void {
  inc("media_upload_total", { card: cardKey, outcome });
}

export function handleLatency(ms: number): void {
  observe("handle_latency_ms", ms);
}
export function replyLatency(ms: number, kind: string): void {
  observe("reply_latency_ms", ms, { kind });
}
export function queueDepth(userId: string, depth: number): void {
  setGauge("user_queue_depth", depth, { user: hashUser(userId) });
}

export function errorRecorded(where: string, code?: string): void {
  inc("errors_total", { where, code: code ?? "unknown" });
}
export function warnRecorded(where: string): void {
  inc("warnings_total", { where });
}

export function webhookReceived(kind: "message" | "status" | "unknown"): void {
  inc("webhook_events_total", { kind });
}

// ── snapshot ───────────────────────────────────────────────────────────────

export interface HistogramSummary {
  count: number;
  sum: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  buckets: Record<string, number>;
}

export interface Snapshot {
  ts: string;
  rangeDays: number;
  from: string;
  to: string;
  counters: Record<string, number>;
  histograms: Record<string, HistogramSummary>;
  uniques: Record<string, number>;
}

const daysBack = (n: number) => dayKey(Date.now() - n * 86_400_000);

/**
 * Aggregate counters + histograms + uniques across the last `days` days.
 * Supabase path is a single SELECT per table over the date range. Memory
 * path iterates in-process state. Returned shape is identical.
 */
export async function snapshot(days = 7): Promise<Snapshot> {
  const from = daysBack(days - 1);
  const to = daysBack(0);
  const sb = getSupabase();
  const { counters: rawCounters, histBuckets, histSums, histCounts } = sb
    ? await readCountersSupabase(sb, from, to)
    : readCountersMemory(from, to);
  const uniques = sb ? await readUniquesSupabase(sb, from, to) : readUniquesMemory(from, to);

  const histograms: Record<string, HistogramSummary> = {};
  for (const base of Object.keys(histBuckets)) {
    const buckets = histBuckets[base];
    const count = histCounts[base] ?? Object.values(buckets).reduce((a, b) => a + b, 0);
    const sum = histSums[base] ?? 0;
    histograms[base] = {
      count,
      sum,
      avg: count === 0 ? 0 : sum / count,
      p50: estimatePercentile(buckets, count, 50),
      p95: estimatePercentile(buckets, count, 95),
      p99: estimatePercentile(buckets, count, 99),
      buckets,
    };
  }

  return {
    ts: new Date().toISOString(),
    rangeDays: days,
    from,
    to,
    counters: rawCounters,
    histograms,
    uniques,
  };
}

type CountersRead = {
  counters: Record<string, number>;
  histBuckets: Record<string, Record<string, number>>;
  histSums: Record<string, number>;
  histCounts: Record<string, number>;
};

async function readCountersSupabase(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  from: string,
  to: string,
): Promise<CountersRead> {
  const out: CountersRead = { counters: {}, histBuckets: {}, histSums: {}, histCounts: {} };
  const { data, error } = await sb
    .from("cfe_metric_counters")
    .select("name, labels, value")
    .gte("day", from)
    .lte("day", to);
  if (error) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), category: "WARN", step: "snapshot.counters", error: String(error.message ?? error) }));
    return out;
  }
  for (const row of data ?? []) {
    accumulate(out, row.name as string, row.labels as Record<string, string>, Number(row.value));
  }
  return out;
}

function readCountersMemory(from: string, to: string): CountersRead {
  const out: CountersRead = { counters: {}, histBuckets: {}, histSums: {}, histCounts: {} };
  for (const [k, v] of memory.counters) {
    const [day, name, labelsJson] = k.split("|", 3);
    if (day < from || day > to) continue;
    const labels = labelsJson ? JSON.parse(labelsJson) as Record<string, string> : {};
    accumulate(out, name, labels, v);
  }
  return out;
}

function accumulate(out: CountersRead, name: string, labels: Record<string, string>, value: number) {
  if (name.endsWith("__bucket")) {
    const base = name.slice(0, -"__bucket".length);
    const bucket = labels.bucket ?? "unknown";
    const existing = out.histBuckets[base] ?? (out.histBuckets[base] = {});
    existing[bucket] = (existing[bucket] ?? 0) + value;
  } else if (name.endsWith("__sum")) {
    const base = name.slice(0, -"__sum".length);
    out.histSums[base] = (out.histSums[base] ?? 0) + value;
  } else if (name.endsWith("__count")) {
    const base = name.slice(0, -"__count".length);
    out.histCounts[base] = (out.histCounts[base] ?? 0) + value;
  } else {
    const flat = Object.keys(labels).length
      ? `${name}{${Object.entries(labels).sort().map(([k, v]) => `${k}="${v}"`).join(",")}}`
      : name;
    out.counters[flat] = (out.counters[flat] ?? 0) + value;
  }
}

async function readUniquesSupabase(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  from: string,
  to: string,
): Promise<Record<string, number>> {
  // Rolling distinct count across the window: group by set_name, count
  // distinct user_id. Done via a single SELECT so cost scales with distinct
  // (set_name, user_id) pairs in the window, not raw row count.
  const { data, error } = await sb
    .from("cfe_metric_uniques")
    .select("set_name, user_id")
    .gte("day", from)
    .lte("day", to);
  if (error) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), category: "WARN", step: "snapshot.uniques", error: String(error.message ?? error) }));
    return {};
  }
  const sets: Record<string, Set<string>> = {};
  for (const row of data ?? []) {
    const name = row.set_name as string;
    const user = row.user_id as string;
    (sets[name] ??= new Set()).add(user);
  }
  const out: Record<string, number> = {};
  for (const [k, s] of Object.entries(sets)) out[k] = s.size;
  return out;
}

function readUniquesMemory(from: string, to: string): Record<string, number> {
  const sets: Record<string, Set<string>> = {};
  for (const [k, s] of memory.uniques) {
    const [day, name] = k.split("|", 2);
    if (day < from || day > to) continue;
    const dest = sets[name] ?? (sets[name] = new Set());
    for (const u of s) dest.add(u);
  }
  const out: Record<string, number> = {};
  for (const [k, s] of Object.entries(sets)) out[k] = s.size;
  return out;
}

function estimatePercentile(buckets: Record<string, number>, total: number, p: number): number {
  if (total === 0) return 0;
  const target = (p / 100) * total;
  const sorted = [...BUCKETS_MS, Infinity].map((b) => String(b === Infinity ? "inf" : b));
  let cum = 0;
  for (const b of sorted) {
    cum += buckets[b] ?? 0;
    if (cum >= target) return b === "inf" ? 30_000 : Number(b);
  }
  return 30_000;
}

/** Clear ALL in-memory metrics state. Tests only. */
export function reset(): void {
  memory.counters.clear();
  memory.uniques.clear();
}

/** Flush pending microtask-scheduled writes. Tests only. */
export async function _flushForTests(): Promise<void> {
  await new Promise<void>((r) => queueMicrotask(() => r()));
  await new Promise<void>((r) => queueMicrotask(() => r()));
}

function hashUser(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
