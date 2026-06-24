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
import { QUIZ_BANK } from "../src/quiz.ts";

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

Deno.test("first contact with clear Swahili auto-detects and skips picker", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "habari za leo rafiki");
  // Tool 1 detects Swahili → Tool 2 sends welcome menu directly in Swahili
  const menu = sent.find((m) => m.kind === "list");
  assert(menu, "welcome menu sent in Swahili without picker");
  assert(menu!.rows?.some((r) => r.id === "j_learn"), "menu has learn journey");
});

Deno.test("choosing a language shows the 4-journey main menu", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  const menu = sent.find((m) => m.kind === "list");
  assert(menu, "main menu list sent");
  const ids = menu!.rows!.map((r) => r.id);
  assertEquals(ids.length, 4);
  assert(["j_learn", "j_products", "j_quiz", "j_ask"].every((id) => ids.includes(id)));
});

Deno.test("learn → level starts the first module directly (walk)", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "j_learn");
  const levels = last(sent);
  assertEquals(levels.kind, "list");
  assert(levels.rows!.some((r) => r.id === "lvl_beginner"));

  sent.length = 0;
  await bot.handle(USER, "lvl_beginner"); // → presents module 1 directly, no list
  const screen = last(sent);
  assertEquals(screen.kind, "buttons");
  assert(screen.body.includes("Investing"), `got: ${screen.body}`);
  assert(screen.buttons?.some((b) => b.id === "scr_next"));
});

Deno.test("walking Next reaches the module completion screen", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "j_learn");
  await bot.handle(USER, "lvl_beginner"); // starts at basic-concepts (13 screens)
  for (let i = 0; i < 13; i++) await bot.handle(USER, "scr_next");
  const done = sent.find((m) => m.body.includes("Module complete"));
  assert(done, "completion message sent");
  assert(done!.buttons?.some((b) => b.id === "nextmod"), "offers next module");
});

Deno.test("nextmod advances to the next module in the level", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "lvl_beginner"); // basic-concepts
  sent.length = 0;
  await bot.handle(USER, "nextmod"); // → why-invest (module 2)
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
  await bot.handle(USER, "lvl_beginner"); // module 1 template
  await bot.handle(USER, "nextmod"); // module 2 template
  assertEquals(calls[0], "basic-concepts");
  assertEquals(calls[1], "why-invest");
});

Deno.test("a coming-soon academy module says so", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "j_products");
  sent.length = 0;
  await bot.handle(USER, "aca_utt"); // first academy module is coming_soon
  assert(sent.some((m) => m.kind === "text" && m.body.toLowerCase().includes("coming soon")));
});

Deno.test("products shows the academy list", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "j_products");
  const list = last(sent);
  assert(list.rows!.some((r) => r.id === "aca_utt"));
});

Deno.test("quiz runs through all questions and scores", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "j_quiz");
  for (let i = 0; i < QUIZ_BANK.length; i++) await bot.handle(USER, "ans_0");
  const result = sent.find((m) => m.body.includes(`${QUIZ_BANK.length}/${QUIZ_BANK.length}`));
  assert(result, "results message with full score sent");
});

Deno.test("ask journey shows the tutor prompt", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_sw");
  sent.length = 0;
  await bot.handle(USER, "j_ask");
  assert(last(sent).body.toLowerCase().includes("uliza"));
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
