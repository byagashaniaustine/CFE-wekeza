// User session store backed by Deno KV (falls back to in-memory map for tests).
import type { Lang } from "./content.ts";
import { log } from "./logger.ts";

// Top-level mode the user picks up front. Each mode has its own tool surface
// under src/tools/. `state` below still drives sub-navigation inside the mode.
export type Mode = "education" | "onboarding" | "simulation" | "ask";

export type BotState =
  | "new"
  | "mode_pick" // the 3-state picker (Education / Onboarding / Simulation)
  | "menu" // education sub-menu (Learn / Products / Quiz / Ask)
  | "learn_levels" // choosing Beginner/Intermediate/Advanced
  | "learn_modules" // choosing a module within a level
  | "products" // choosing a product academy
  | "products_modules" // choosing a module within an academy
  | "module" // inside a module, walking lesson screens
  | "quiz"
  | "ask" // free-text tutor mode
  | "onboarding_platform_pick" // choosing UTT / DSE / Govt Securities before the Flow launches
  | "onboarding_done" // waiting for post-onboarding feedback (👍/👎)
  | "simulation_pick"; // choosing simulation vs DSE challenge

export interface Session {
  lang: Lang | null; // null = not chosen yet
  mode: Mode | null; // null = not chosen yet — show mode picker
  state: BotState;
  levelId: string | null; // current level (learn path)
  academyId: string | null; // current academy (products path)
  moduleId: string | null; // active module
  lessonIdx: number; // index into module.lessons
  screenIdx: number; // index into lesson.screens
  quizIdx: number;
  score: number;
  quizWrong: string[]; // topics answered incorrectly (for recommendations)
  history: Array<{ role: "user" | "assistant"; content: string }>;
  lastLeadScheme: string | null; // last onboarding scheme (utt/dse/govsec/pension) — for feedback + URL routing
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
  quizWrong: [],
  history: [],
  lastLeadScheme: null,
});

export interface SessionStore {
  get(user: string): Promise<Session>;
  set(user: string, s: Session): Promise<void>;
}

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

export async function createKvStore(): Promise<SessionStore> {
  const kv = await Deno.openKv();
  return {
    async get(u) {
      const r = await kv.get<Session>(["session", u]);
      const s = { ...freshSession(), ...(r.value ?? {}) };
      log("SESSION_GET", {
        user: u,
        hit: r.value !== null,
        state: s.state,
        lang: s.lang,
        moduleId: s.moduleId,
      });
      return s;
    },
    async set(u, s) {
      await kv.set(["session", u], s, { expireIn: 1000 * 60 * 60 * 24 * 30 });
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
