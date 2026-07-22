// In-process metrics collection for CFE.Wekeza. Counters, gauges and latency
// histograms grouped by domain (engagement, journeys, quiz, LLM, delivery,
// errors). Domain code calls the named recorders below; `snapshot()` returns
// the current state — dump it from a debug endpoint, log it on a timer, or
// scrape it however you like. No external dependencies; safe to call from
// anywhere.
import type { Lang } from "./content.ts";

// ── primitives ──────────────────────────────────────────────────────────────
type Labels = Record<string, string>;

const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const histograms = new Map<string, number[]>();
const uniqueSets = new Map<string, Set<string>>();

const key = (name: string, labels?: Labels): string =>
  labels && Object.keys(labels).length
    ? `${name}{${Object.entries(labels).sort().map(([k, v]) => `${k}="${v}"`).join(",")}}`
    : name;

function inc(name: string, labels?: Labels, by = 1): void {
  const k = key(name, labels);
  counters.set(k, (counters.get(k) ?? 0) + by);
}

function setGauge(name: string, value: number, labels?: Labels): void {
  gauges.set(key(name, labels), value);
}

function observe(name: string, value: number, labels?: Labels): void {
  const k = key(name, labels);
  const arr = histograms.get(k) ?? [];
  arr.push(value);
  // Cap per-histogram memory. 10k samples is plenty for p50/p95/p99 stability.
  if (arr.length > 10_000) arr.splice(0, arr.length - 10_000);
  histograms.set(k, arr);
}

function addUnique(setName: string, id: string): void {
  const s = uniqueSets.get(setName) ?? new Set<string>();
  s.add(id);
  uniqueSets.set(setName, s);
}

// ── engagement ──────────────────────────────────────────────────────────────
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

// ── journeys / navigation ───────────────────────────────────────────────────
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

// Per-screen advance/back so we can see which lesson screens users drop off at.
export function screenAdvance(moduleId: string, lessonIdx: number, screenIdx: number, dir: "next" | "prev"): void {
  inc("screen_nav_total", {
    module: moduleId,
    lesson: String(lessonIdx),
    screen: String(screenIdx),
    dir,
  });
}

// ── quiz ────────────────────────────────────────────────────────────────────
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

// ── AI tutor / LLM ──────────────────────────────────────────────────────────
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

// ── delivery: templates, flows, media ───────────────────────────────────────
export function templateSend(templateName: string, outcome: "ok" | "error", lang: Lang): void {
  inc("template_send_total", { template: templateName, outcome, lang });
}

export function flowLaunch(moduleId: string, outcome: "ok" | "fallback", lang: Lang): void {
  inc("flow_launch_total", { module: moduleId, outcome, lang });
}

export function mediaUpload(cardKey: string, outcome: "ok" | "error"): void {
  inc("media_upload_total", { card: cardKey, outcome });
}

// ── performance ─────────────────────────────────────────────────────────────
export function handleLatency(ms: number): void {
  observe("handle_latency_ms", ms);
}

export function replyLatency(ms: number, kind: string): void {
  observe("reply_latency_ms", ms, { kind });
}

export function queueDepth(userId: string, depth: number): void {
  setGauge("user_queue_depth", depth, { user: hashUser(userId) });
}

// ── errors / warnings ───────────────────────────────────────────────────────
export function errorRecorded(where: string, code?: string): void {
  inc("errors_total", { where, code: code ?? "unknown" });
}

export function warnRecorded(where: string): void {
  inc("warnings_total", { where });
}

// ── webhook ─────────────────────────────────────────────────────────────────
export function webhookReceived(kind: "message" | "status" | "unknown"): void {
  inc("webhook_events_total", { kind });
}

// ── snapshot / reset ────────────────────────────────────────────────────────
export interface HistogramSummary {
  count: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  avg: number;
}

export interface Snapshot {
  ts: string;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, HistogramSummary>;
  uniques: Record<string, number>;
}

export function snapshot(): Snapshot {
  return {
    ts: new Date().toISOString(),
    counters: Object.fromEntries(counters),
    gauges: Object.fromEntries(gauges),
    histograms: Object.fromEntries(
      Array.from(histograms, ([k, v]) => [k, summarise(v)] as const),
    ),
    uniques: Object.fromEntries(
      Array.from(uniqueSets, ([k, v]) => [k, v.size] as const),
    ),
  };
}

export function reset(): void {
  counters.clear();
  gauges.clear();
  histograms.clear();
  uniqueSets.clear();
}

function summarise(samples: number[]): HistogramSummary {
  if (samples.length === 0) {
    return { count: 0, min: 0, p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    min: sorted[0],
    p50: pct(50),
    p95: pct(95),
    p99: pct(99),
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
  };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// Short stable label — avoids leaking WhatsApp phone numbers into gauge keys.
function hashUser(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
