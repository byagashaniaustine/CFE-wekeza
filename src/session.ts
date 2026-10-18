// User session store.
//
// Primary storage: Supabase (table `cfe_sessions`, see
// supabase/migrations/0001_cfe_bot_core.sql). Chosen over Deno KV because:
//   • durable + globally shared across isolates with no `--unstable-kv`;
//   • rich indexed queries so the dashboard reads the same table directly
//     (no proxy, no event-stream rebuild);
//   • works identically in local dev and on Deno Deploy.
//
// Fallback: in-process Map (for tests and for local runs with no SUPABASE_URL).
// Both implementations share the SessionStore interface so bot.ts never knows
// which one is active.

import type { Lang } from "./content.ts";
import { log } from "./logger.ts";
import { getSupabase } from "./supabase.ts";

export type Mode = "education" | "onboarding" | "simulation" | "ask" | "consumer";

export type BotState =
  | "new"
  | "mode_pick"
  | "menu"
  | "learn_levels"
  | "learn_modules"
  | "products"
  | "products_modules"
  | "module"
  | "quiz"
  | "ask"
  | "onboarding_platform_pick"
  | "onboarding_done"
  | "simulation_pick"
  | "consumer_menu"
  | "consumer_verify_wait"
  | "consumer_scan_wait";

export interface Session {
  lang: Lang | null;
  mode: Mode | null;
  state: BotState;
  levelId: string | null;
  academyId: string | null;
  moduleId: string | null;
  lessonIdx: number;
  screenIdx: number;
  quizIdx: number;
  score: number;
  quizPick: number[];
  quizStreak: number;
  quizWrong: string[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
  lastLeadScheme: string | null;
}

export const freshSession = (): Session => ({
  lang: null,
  mode: null,
  state: "new",
  levelId: null,
  academyId: null,
  moduleId: null,
  lessonIdx: 0,
  screenIdx: 0,
  quizIdx: 0,
  score: 0,
  quizPick: [],
  quizStreak: 0,
  quizWrong: [],
  history: [],
  lastLeadScheme: null,
});

export interface SessionStore {
  get(user: string): Promise<Session>;
  set(user: string, s: Session): Promise<void>;
}

// ── in-memory store (tests + local dev without Supabase) ───────────────────
export function createMemoryStore(): SessionStore {
  const map = new Map<string, Session>();
  return {
    get: (u) => Promise.resolve(map.get(u) ?? freshSession()),
    set: (u, s) => {
      map.set(u, s);
      return Promise.resolve();
    },
  };
}

// ── Supabase store (production) ────────────────────────────────────────────
// Columns map 1:1 to the Session shape with snake_case naming (matches the
// SQL schema). JSON fields (quiz_pick / quiz_wrong / history) are stored as
// jsonb and round-trip transparently via supabase-js.
interface SessionRow {
  user_id: string;
  lang: Lang | null;
  mode: Mode | null;
  state: BotState;
  level_id: string | null;
  academy_id: string | null;
  module_id: string | null;
  lesson_idx: number;
  screen_idx: number;
  quiz_idx: number;
  score: number;
  quiz_pick: number[];
  quiz_streak: number;
  quiz_wrong: string[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
  last_lead_scheme: string | null;
  updated_at: string;
}

function rowToSession(r: SessionRow): Session {
  return {
    lang: r.lang,
    mode: r.mode,
    state: r.state,
    levelId: r.level_id,
    academyId: r.academy_id,
    moduleId: r.module_id,
    lessonIdx: r.lesson_idx,
    screenIdx: r.screen_idx,
    quizIdx: r.quiz_idx,
    score: r.score,
    quizPick: r.quiz_pick ?? [],
    quizStreak: r.quiz_streak,
    quizWrong: r.quiz_wrong ?? [],
    history: r.history ?? [],
    lastLeadScheme: r.last_lead_scheme,
  };
}

function sessionToRow(user: string, s: Session): SessionRow {
  return {
    user_id: user,
    lang: s.lang,
    mode: s.mode,
    state: s.state,
    level_id: s.levelId,
    academy_id: s.academyId,
    module_id: s.moduleId,
    lesson_idx: s.lessonIdx,
    screen_idx: s.screenIdx,
    quiz_idx: s.quizIdx,
    score: s.score,
    quiz_pick: s.quizPick,
    quiz_streak: s.quizStreak,
    quiz_wrong: s.quizWrong,
    history: s.history,
    last_lead_scheme: s.lastLeadScheme,
    updated_at: new Date().toISOString(),
  };
}

export function createSupabaseStore(): SessionStore {
  const sb = getSupabase();
  if (!sb) throw new Error("createSupabaseStore called but SUPABASE_URL/SERVICE_ROLE_KEY not set");

  return {
    async get(u) {
      const { data, error } = await sb
        .from("cfe_sessions")
        .select("*")
        .eq("user_id", u)
        .maybeSingle();
      if (error) {
        log("WARN", { step: "session.get", user: u, error: String(error.message ?? error) });
        return freshSession();
      }
      const s = data ? rowToSession(data as SessionRow) : freshSession();
      log("SESSION_GET", {
        user: u,
        hit: data !== null,
        state: s.state,
        lang: s.lang,
        moduleId: s.moduleId,
      });
      return s;
    },
    async set(u, s) {
      const row = sessionToRow(u, s);
      const { error } = await sb
        .from("cfe_sessions")
        .upsert(row, { onConflict: "user_id" });
      if (error) {
        // Don't throw — session state is best-effort; a failed write means
        // the next turn starts from the previous saved state. Logged for ops.
        log("WARN", { step: "session.set", user: u, error: String(error.message ?? error) });
        return;
      }
      log("SESSION_SET", {
        user: u,
        state: s.state,
        mode: s.mode,
        lang: s.lang,
        moduleId: s.moduleId,
        lessonIdx: s.lessonIdx,
        screenIdx: s.screenIdx,
        quizIdx: s.quizIdx,
      });
    },
  };
}

/**
 * Factory used by main.ts. Prefers Supabase if the env is configured; falls
 * back to in-memory for local dev / tests. Logs the choice at boot so ops can
 * see which storage is live.
 */
export function createSessionStore(): SessionStore {
  if (getSupabase()) {
    log("BOOT", { step: "session.store", target: "supabase" });
    return createSupabaseStore();
  }
  log("WARN", { step: "session.store", msg: "SUPABASE_URL/SERVICE_ROLE_KEY not set — using in-memory sessions (dev only)" });
  return createMemoryStore();
}

// Backwards-compat alias so older callers still resolve. Prefer createSessionStore.
export const createKvStore = createSessionStore;
