// Minimal assertions (no external deps).
function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) throw new Error(msg ?? `expected ${expected}, got ${actual}`);
}
import { createBot } from "../src/bot.ts";
import { createMemoryStore } from "../src/session.ts";
import type { OutboundMessage } from "../src/whatsapp.ts";
import { ACADEMIES, LEVELS } from "../src/curriculum.ts";
import { QUIZ_BANK, QUIZ_LEN } from "../src/quiz.ts";
import {
  _flushForTests as flushRecorder,
  _resetForTests as resetRecorder,
  _snapshotForTests as snapshotRecorder,
} from "../src/recorder.ts";

function setup() {
  const sent: OutboundMessage[] = [];
  const bot = createBot(createMemoryStore(), (m) => {
    sent.push(m);
    return Promise.resolve();
  });
  return { bot, sent };
}

const USER = "255700000001";
const last = (a: OutboundMessage[]) => a[a.length - 1];

Deno.test("first contact (no greeting) asks for language", async () => {
  const { bot, sent } = setup();
  // A purely numeric / ambiguous message cannot be detected → show picker
  await bot.handle(USER, "123");
  assertEquals(sent[0].kind, "buttons");
  assert(sent[0].buttons?.some((b) => b.id === "lang_sw"));
});

Deno.test("first contact with clear Swahili auto-detects and shows mode picker", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "habari za leo rafiki");
  // Tool 1 detects Swahili → picker rendered in Swahili
  const picker = sent.find((m) => m.kind === "list");
  assert(picker, "mode picker sent in Swahili without lang prompt");
  assert(picker!.rows?.some((r) => r.id === "mode_education"), "picker has education mode");
});

Deno.test("choosing a language shows the 5-state mode picker", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  const picker = sent.find((m) => m.kind === "list");
  assert(picker, "mode picker list sent");
  const ids = picker!.rows!.map((r) => r.id);
  assertEquals(ids.length, 5);
  assert(
    ["mode_education", "mode_onboarding", "mode_simulation", "mode_ask", "mode_consumer"].every((id) => ids.includes(id)),
    `picker rows: ${ids.join(",")}`,
  );
});

Deno.test("picking Education reveals the 4-journey sub-menu", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  sent.length = 0;
  await bot.handle(USER, "mode_education");
  const menu = last(sent);
  assertEquals(menu.kind, "list");
  const ids = menu.rows!.map((r) => r.id);
  assert(["j_learn", "j_products", "j_quiz", "j_ask"].every((id) => ids.includes(id)));
});

Deno.test("learn → level starts the first module directly (walk)", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_education");
  await bot.handle(USER, "j_learn");
  const levels = last(sent);
  assertEquals(levels.kind, "list");
  assert(levels.rows!.some((r) => r.id === "lvl_beginner"));

  sent.length = 0;
  await bot.handle(USER, "lvl_beginner");
  const screen = last(sent);
  assertEquals(screen.kind, "buttons");
  assert(screen.body.includes("Investing"), `got: ${screen.body}`);
  assert(screen.buttons?.some((b) => b.id === "scr_next"));
});

Deno.test("walking Next reaches the module completion screen", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_education");
  await bot.handle(USER, "j_learn");
  await bot.handle(USER, "lvl_beginner");
  for (let i = 0; i < 13; i++) await bot.handle(USER, "scr_next");
  const done = sent.find((m) => m.body.includes("Module complete"));
  assert(done, "completion message sent");
  assert(done!.buttons?.some((b) => b.id === "nextmod"), "offers next module");
});

Deno.test("nextmod advances to the next module in the level", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_education");
  await bot.handle(USER, "lvl_beginner");
  sent.length = 0;
  await bot.handle(USER, "nextmod");
  assert(last(sent).body.includes("Importance of Investing"), `got: ${last(sent).body}`);
});

Deno.test("template module entry is used and Next walks the level", async () => {
  const calls: string[] = [];
  const sent: OutboundMessage[] = [];
  const bot = createBot(createMemoryStore(), (m) => {
    sent.push(m);
    return Promise.resolve();
  }, {
    sendModuleEntry: (_to, moduleId) => {
      calls.push(moduleId);
      return Promise.resolve(true);
    },
  });
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_education");
  await bot.handle(USER, "lvl_beginner");
  await bot.handle(USER, "nextmod");
  assertEquals(calls[0], "basic-concepts");
  assertEquals(calls[1], "why-invest");
});

Deno.test("a coming-soon academy module says so", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_education");
  await bot.handle(USER, "j_products");
  sent.length = 0;
  await bot.handle(USER, "aca_utt");
  assert(sent.some((m) => m.kind === "text" && m.body.toLowerCase().includes("coming soon")));
});

Deno.test("products shows the academy list", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_education");
  await bot.handle(USER, "j_products");
  const list = last(sent);
  assert(list.rows!.some((r) => r.id === "aca_utt"));
});

Deno.test("quiz runs a rotating set and scores", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_education");
  await bot.handle(USER, "j_quiz");
  for (let i = 0; i < QUIZ_LEN; i++) await bot.handle(USER, "ans_0");
  // Each attempt asks QUIZ_LEN questions; the result shows "score/QUIZ_LEN (pct%)".
  // The "%" uniquely distinguishes the result from the per-answer score line.
  const result = sent.find((m) => m.body.includes(`/${QUIZ_LEN}`) && m.body.includes("%"));
  assert(result, "results message with score out of total sent");
});

Deno.test("ask journey shows the tutor prompt", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_sw");
  await bot.handle(USER, "mode_education");
  sent.length = 0;
  await bot.handle(USER, "j_ask");
  assert(last(sent).body.toLowerCase().includes("uliza"));
});

Deno.test("consumer report: FSP-not-yet-contacted shows guidance and returns to menu", async () => {
  resetRecorder();
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_consumer");
  await bot.handle(USER, "cp_report");
  sent.length = 0;
  await bot.handle(USER, "cpr_fsp_no");
  // User must see FSP-first guidance (14-day language) and then the menu again.
  const guidance = sent.find((m) => m.kind === "text" && m.body.includes("14 days"));
  assert(guidance, "FSP-first guidance sent");
  const menuAfter = sent.find((m) => m.kind === "list" && m.rows?.some((r) => r.id === "cp_report"));
  assert(menuAfter, "returned to consumer menu");
  // No row should be written to cfe_consumer_reports — user never submitted.
  await flushRecorder();
  assertEquals(snapshotRecorder().reports.length, 0);
});

Deno.test("consumer report: full submission records a row + HITL item", async () => {
  resetRecorder();
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_consumer");
  await bot.handle(USER, "cp_report");
  await bot.handle(USER, "cpr_fsp_yes");
  await bot.handle(USER, "cpr_days_yes");
  await bot.handle(USER, "CRDB Bank");
  await bot.handle(USER, "Wrong amount debited on 2026-10-15, TZS 50,000, ref TX998877");
  sent.length = 0;
  await bot.handle(USER, "They said they would investigate but never followed up.");
  await flushRecorder();
  const snap = snapshotRecorder();
  assertEquals(snap.reports.length, 1, "one report row written");
  const row = snap.reports[0] as Record<string, unknown>;
  assertEquals(row.fsp_name, "CRDB Bank");
  assertEquals(row.status, "awaiting_bot");
  assertEquals(row.fsp_contacted, true);
  // HITL item enqueued for ops, with the BoT-complaint tag.
  const hitl = snap.hitl.find((h) => (h as Record<string, unknown>).tag === "BoT complaint");
  assert(hitl, "HITL item enqueued with 'BoT complaint' tag");
  // The user got BoT contact details back.
  const bodies = sent.map((m) => m.body).join("\n");
  assert(bodies.includes("bot.go.tz"), "BoT website shared with user");
  assert(bodies.includes("botcommunications@bot.go.tz"), "BoT email shared");
});

Deno.test("consumer report: cancel mid-flow clears draft + returns to menu", async () => {
  resetRecorder();
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_consumer");
  await bot.handle(USER, "cp_report");
  await bot.handle(USER, "cpr_fsp_yes");
  await bot.handle(USER, "cpr_days_yes");
  await bot.handle(USER, "NMB Bank");
  sent.length = 0;
  await bot.handle(USER, "cpr_cancel");
  // "Report cancelled" line + menu again.
  const cancelMsg = sent.find((m) => m.kind === "text" && m.body.toLowerCase().includes("cancel"));
  assert(cancelMsg, "cancel confirmation sent");
  const menu = sent.find((m) => m.kind === "list" && m.rows?.some((r) => r.id === "cp_report"));
  assert(menu, "menu re-rendered");
  await flushRecorder();
  // No row written — the user bailed mid-flow.
  assertEquals(snapshotRecorder().reports.length, 0);
});

Deno.test("content integrity: curriculum parity, limits, quiz shape", () => {
  for (const group of [...LEVELS, ...ACADEMIES]) {
    for (const m of group.modules) {
      for (const lang of ["en", "sw"] as const) {
        assert(m.short[lang].length <= 20, `short >20: ${m.short[lang]}`);
        assert(m.title[lang].length > 0);
      }
      if (m.status === "ready") assert(m.lessons.length > 0, `ready but empty: ${m.id}`);
      for (const lesson of m.lessons) {
        for (const sc of lesson.screens) {
          for (const lang of ["en", "sw"] as const) {
            assert(sc.body[lang].length < 1024, `screen body too long in ${m.id}`);
            assert(sc.title[lang].length > 0);
          }
        }
      }
    }
  }
  for (const q of QUIZ_BANK) {
    assertEquals(q.options.length, 3);
    assert(q.answer >= 0 && q.answer <= 2);
    for (const lang of ["en", "sw"] as const) {
      assert(q.q[lang].length > 0);
      for (const o of q.options) assert(o[lang].length > 0);
    }
  }
});
