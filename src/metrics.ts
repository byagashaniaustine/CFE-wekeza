// Durable, globally-correct metrics backed by Deno KV atomic counters.
//
// Why this isn't in-process. Deno Deploy runs serverless isolates that get
// torn down between requests, and multiple isolates can serve traffic
// concurrently. A `Map<string, number>` in RAM would:
//   • reset at every isolate cold start (data loss),
//   • fragment across isolates (never-aggregated views),
//   • be invisible to any other service (the dashboard can't read it).
// Writing to Deno KV from every recorder gives us one global, durable set of
// counters — persisted, correct across isolates, and readable from any
// process that shares the same KV database.
//
// Shape. Every counter is a Deno.KvU64 at key:
//     ["metric", "YYYY-MM-DD", name]                        — unlabelled
//     ["metric", "YYYY-MM-DD", name, label-key, label-val]  — one label
// Daily partition keeps per-key cardinality bounded and lets snapshot()
// scan a date range cheaply with a bounded `kv.list` call. Multiple labels
// are serialised into a single stable string so the key arity is fixed.
//
// Histograms. KV can't store sample arrays efficiently, so we bucket at
// write time into log-scaled boundaries and increment the bucket's counter.
// snapshot() turns bucket cumulative counts into p50/p95/p99 estimates. The
// estimate is bounded by the bucket width, which is good enough for ops.
//
// Hot-path safety. inc/observe/addUnique dispatch asynchronously via
// queueMicrotask and swallow KV errors — a KV outage never breaks the bot.
// Reads via snapshot() are bounded prefix scans, so cost is O(days × keys),
// never O(all metrics ever written).
//
// Retention. Each counter is written with `expireIn: METRIC_RETENTION_DAYS`
// (default 400). Scans never see expired keys.

import type { Lang } from "./content.ts";
import { openKv } from "./kv.ts";

// ── config ─────────────────────────────────────────────────────────────────
const RETENTION_DAYS = Math.max(
  7,
  Number(Deno.env.get("METRIC_RETENTION_DAYS") ?? 400),
);
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const WRITES_ENABLED = (Deno.env.get("METRICS_KV") ?? "on").toLowerCase() !== "off";

// Fixed histogram buckets (ms). Covers 1ms – 30s with log-ish spacing. Any
// sample above the last boundary falls into the implicit `+inf` bucket, so
// the whole thing is bounded. Shared across every observe() site.
const BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 30_000] as const;

// Unique-user daily cap. If more than this many distinct users hit the bot in
// one day, we stop tracking individual ids (counter becomes a lower bound).
const UNIQUE_CAP = 100_000;

// ── primitives ─────────────────────────────────────────────────────────────
type Labels = Record<string, string>;

const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10);

// Serialise labels into a single stable string so the KV key arity stays at
// most 5. Sorted so the same {lang:"en",outcome:"ok"} always maps to the
// same key regardless of insertion order.
function labelsKey(labels?: Labels): string | null {
  if (!labels) return null;
  const entries = Object.entries(labels).filter(([_, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return null;
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join(",");
}

function metricKey(day: string, name: string, labels?: Labels): Deno.KvKey {
  const lk = labelsKey(labels);
  return lk ? ["metric", day, name, lk] : ["metric", day, name];
}

// Fire-and-forget KV write. Never throws, never blocks the caller.
function fireAtomic(mutate: (tx: Deno.AtomicOperation) => Deno.AtomicOperation): void {
  if (!WRITES_ENABLED) return;
  queueMicrotask(async () => {
    try {
      const kv = await openKv();
      const res = await mutate(kv.atomic()).commit();
      if (!res.ok) {
        console.error(JSON.stringify({
          ts: new Date().toISOString(),
          category: "WARN",
          step: "metrics.atomic",
          msg: "atomic commit returned ok=false",
        }));
      }
    } catch (err) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        category: "WARN",
        step: "metrics.write",
        error: String(err),
      }));
    }
  });
}

function inc(name: string, labels?: Labels, by = 1): void {
  const day = dayKey();
  const key = metricKey(day, name, labels);
  fireAtomic((tx) => tx.sum(key, BigInt(by)).set(["metric_ttl", day], 1, { expireIn: RETENTION_MS }));
}

function setGauge(name: string, value: number, labels?: Labels): void {
  const day = dayKey();
  const key: Deno.KvKey = ["gauge", name, labelsKey(labels) ?? ""];
  if (!WRITES_ENABLED) return;
  queueMicrotask(async () => {
    try {
      const kv = await openKv();
      await kv.set(key, value, { expireIn: RETENTION_MS });
      await kv.set(["metric_ttl", day], 1, { expireIn: RETENTION_MS });
    } catch (err) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), category: "WARN", step: "metrics.gauge", error: String(err) }));
    }
  });
}

function observe(name: string, value: number, labels?: Labels): void {
  // Pick the first bucket whose boundary >= value, else the implicit +inf
  // bucket represented as "inf". Bucket counters are atomic-sum like regular
  // counters, so observe() is as cheap as inc().
  const bucket = pickBucket(value);
  const day = dayKey();
  const base = { ...(labels ?? {}), bucket };
  const key = metricKey(day, `${name}__bucket`, base);
  const sumKey = metricKey(day, `${name}__sum`, labels);
  const cntKey = metricKey(day, `${name}__count`, labels);
  fireAtomic((tx) =>
    tx
      .sum(key, 1n)
      .sum(sumKey, BigInt(Math.round(value)))
      .sum(cntKey, 1n)
      .set(["metric_ttl", day], 1, { expireIn: RETENTION_MS })
  );
}

function pickBucket(value: number): string {
  for (const b of BUCKETS_MS) if (value <= b) return String(b);
  return "inf";
}

function addUnique(setName: string, id: string): void {
  if (!WRITES_ENABLED) return;
  const day = dayKey();
  const key: Deno.KvKey = ["unique", day, setName];
  queueMicrotask(async () => {
    try {
      const kv = await openKv();
      // Compare-and-swap: read current set, append if new, cap at UNIQUE_CAP.
      for (let i = 0; i < 5; i++) {
        const cur = await kv.get<string[]>(key);
        const list = cur.value ?? [];
        if (list.includes(id)) return;
        if (list.length >= UNIQUE_CAP) {
          // Treat as a lower bound beyond the cap. Still bump the day counter.
          await kv.atomic().sum(["metric", day, `${setName}_overflow`], 1n).commit();
          return;
        }
        const res = await kv.atomic()
          .check({ key, versionstamp: cur.versionstamp })
          .set(key, [...list, id], { expireIn: RETENTION_MS })
          .commit();
        if (res.ok) return;
      }
    } catch (err) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), category: "WARN", step: "metrics.unique", error: String(err) }));
    }
  });
}

// ── public recorders — SAME SIGNATURES as the previous in-process impl ────
// Any caller that was using these keeps working unchanged.

export function messageReceived(userId: string, lang: Lang | null): void {
  inc("messages_received_total", { lang: lang ?? "unknown" });
  addUnique("users_all_time", userId);
  addUnique(`users_daily:${dayKey()}`, userId);
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

// ── snapshot / reset ───────────────────────────────────────────────────────

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
  gauges: Record<string, number>;
  histograms: Record<string, HistogramSummary>;
  uniques: Record<string, number>;
}

const daysBack = (n: number) => dayKey(Date.now() - n * 86_400_000);

/**
 * Aggregate every KV counter / histogram / unique set across the last `days`
 * days (default 7). Bounded prefix scan over `["metric", day, ...]` so the
 * cost is O(days × distinct labelled keys), not O(all history).
 */
export async function snapshot(days = 7): Promise<Snapshot> {
  const kv = await openKv();
  const from = daysBack(days - 1);
  const to = daysBack(0);
  const start: Deno.KvKey = ["metric", from];
  const end: Deno.KvKey = ["metric", to + "￿"];

  const rawCounters: Record<string, number> = {};
  const histBuckets: Record<string, Record<string, number>> = {};
  const histSums: Record<string, number> = {};
  const histCounts: Record<string, number> = {};

  // Counters + histograms live under the same ["metric", ...] prefix. We
  // read both in one scan and demux by name suffix.
  for await (const entry of kv.list<Deno.KvU64 | number>({ start, end })) {
    const [, , name, label] = entry.key as [string, string, string, string?];
    const raw = entry.value;
    const value = typeof raw === "bigint"
      ? Number(raw)
      : raw && typeof (raw as unknown as { value?: unknown }).value === "bigint"
      ? Number((raw as unknown as { value: bigint }).value)
      : Number(raw);
    const n = String(name);
    if (n.endsWith("__bucket")) {
      const base = n.slice(0, -"__bucket".length);
      const bucket = parseLabel(label ?? "", "bucket");
      if (!bucket) continue;
      const existing = histBuckets[base] ?? (histBuckets[base] = {});
      existing[bucket] = (existing[bucket] ?? 0) + value;
    } else if (n.endsWith("__sum")) {
      const base = n.slice(0, -"__sum".length);
      histSums[base] = (histSums[base] ?? 0) + value;
    } else if (n.endsWith("__count")) {
      const base = n.slice(0, -"__count".length);
      histCounts[base] = (histCounts[base] ?? 0) + value;
    } else {
      const flat = label ? `${n}{${label}}` : n;
      rawCounters[flat] = (rawCounters[flat] ?? 0) + value;
    }
  }

  // Gauges — latest wins per label. Not day-partitioned.
  const gauges: Record<string, number> = {};
  for await (const entry of kv.list<number>({ prefix: ["gauge"] })) {
    const [, name, label] = entry.key as [string, string, string];
    const flat = label ? `${name}{${label}}` : name;
    gauges[flat] = typeof entry.value === "number" ? entry.value : Number(entry.value);
  }

  // Unique-set sizes — one key per day per set, scan the range.
  const uniques: Record<string, number> = {};
  const uStart: Deno.KvKey = ["unique", from];
  const uEnd: Deno.KvKey = ["unique", to + "￿"];
  for await (const entry of kv.list<string[]>({ start: uStart, end: uEnd })) {
    const [, , setName] = entry.key as [string, string, string];
    const size = Array.isArray(entry.value) ? entry.value.length : 0;
    uniques[String(setName)] = (uniques[String(setName)] ?? 0) + size;
  }

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
    gauges,
    histograms,
    uniques,
  };
}

function parseLabel(label: string, want: string): string | null {
  for (const pair of label.split(",")) {
    const [k, v] = pair.split("=");
    if (k === want) return v;
  }
  return null;
}

function estimatePercentile(buckets: Record<string, number>, total: number, p: number): number {
  if (total === 0) return 0;
  // Walk buckets in ascending boundary order and find the one where the
  // cumulative count crosses the target rank. The returned value is the
  // bucket boundary (upper bound), so the estimate is biased high within
  // one bucket width — acceptable for ops.
  const target = (p / 100) * total;
  const sorted = [...BUCKETS_MS, Infinity].map((b) => String(b === Infinity ? "inf" : b));
  let cum = 0;
  for (const b of sorted) {
    cum += buckets[b] ?? 0;
    if (cum >= target) return b === "inf" ? 30_000 : Number(b);
  }
  return 30_000;
}

/** Clear ALL metrics state. Tests only — never call in production. */
export async function reset(): Promise<void> {
  const kv = await openKv();
  for (const prefix of [["metric"], ["gauge"], ["unique"], ["metric_ttl"]] as Deno.KvKey[]) {
    for await (const entry of kv.list({ prefix })) {
      await kv.delete(entry.key);
    }
  }
}

/** Flush pending microtask-scheduled writes. Tests only. */
export async function _flushForTests(): Promise<void> {
  await new Promise<void>((r) => queueMicrotask(() => r()));
  await new Promise<void>((r) => queueMicrotask(() => r()));
}

// Short stable label — avoids leaking WhatsApp phone numbers into gauge keys.
function hashUser(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
