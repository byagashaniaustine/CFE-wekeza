// Covers the 3-state router: mode picker, per-mode dispatch, feedback, back-to-modes.
function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) throw new Error(msg ?? `expected ${expected}, got ${actual}`);
}

import { createBot } from "../src/bot.ts";
import { createMemoryStore } from "../src/session.ts";
import type { OutboundMessage } from "../src/whatsapp.ts";
import {
  normalizeLead,
  resolveOnboardingUrl,
} from "../src/tools/onboarding.ts";

const USER = "255700000002";
const last = (a: OutboundMessage[]) => a[a.length - 1];

function setup(extra: Parameters<typeof createBot>[2] = {}) {
  const sent: OutboundMessage[] = [];
  const bot = createBot(createMemoryStore(), (m) => {
    sent.push(m);
    return Promise.resolve();
  }, extra);
  return { bot, sent };
}

Deno.test("mode picker exposes all four modes with descriptions", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  const picker = sent.find((m) => m.kind === "list");
  assert(picker);
  const ids = picker!.rows!.map((r) => r.id);
  assertEquals(ids.length, 4);
  assert(ids.includes("mode_education"));
  assert(ids.includes("mode_onboarding"));
  assert(ids.includes("mode_simulation"));
  assert(ids.includes("mode_ask"));
  for (const r of picker!.rows!) assert(r.description && r.description.length > 0);
});

Deno.test("mode_ask shows the tutor intro in Swahili when lang=sw", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_sw");
  sent.length = 0;
  await bot.handle(USER, "mode_ask");
  const msg = last(sent);
  assertEquals(msg.kind, "text");
  assert(msg.body.toLowerCase().includes("uliza"), `got: ${msg.body}`);
});

Deno.test("mode_onboarding opens the platform picker (list of 3 + back)", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  sent.length = 0;
  await bot.handle(USER, "mode_onboarding");
  const picker = last(sent);
  assertEquals(picker.kind, "list");
  const ids = picker.rows!.map((r) => r.id);
  assert(ids.includes("plat_utt"));
  assert(ids.includes("plat_dse"));
  assert(ids.includes("plat_govsec"));
  assert(ids.includes("go_modes"));
});

Deno.test("plat_utt fires sendOnboardingEntry with scheme=utt", async () => {
  const calls: Array<{ to: string; lang: string; scheme?: string }> = [];
  const { bot } = setup({
    sendOnboardingEntry: (to, lang, scheme) => {
      calls.push({ to, lang, scheme });
      return Promise.resolve(true);
    },
  });
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_onboarding");
  await bot.handle(USER, "plat_utt");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].scheme, "utt");
});

Deno.test("plat_dse fires sendOnboardingEntry with scheme=dse", async () => {
  const calls: Array<{ scheme?: string }> = [];
  const { bot } = setup({
    sendOnboardingEntry: (_to, _lang, scheme) => {
      calls.push({ scheme });
      return Promise.resolve(true);
    },
  });
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_onboarding");
  await bot.handle(USER, "plat_dse");
  assertEquals(calls[0].scheme, "dse");
});

Deno.test("platform picker shows failure retry when template unset", async () => {
  const { bot, sent } = setup(); // no sendOnboardingEntry
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_onboarding");
  sent.length = 0;
  await bot.handle(USER, "plat_utt");
  const msg = last(sent);
  assertEquals(msg.kind, "buttons");
  assert(msg.buttons?.some((b) => b.id === "mode_onboarding"), "retry present");
});

Deno.test("plat_govsec shows coming-soon text and re-renders the platform picker", async () => {
  const calls: Array<{ scheme?: string }> = [];
  const { bot, sent } = setup({
    sendOnboardingEntry: (_to, _lang, scheme) => {
      calls.push({ scheme });
      return Promise.resolve(true);
    },
  });
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_onboarding");
  sent.length = 0;
  await bot.handle(USER, "plat_govsec");
  // Must NOT have called sendOnboardingEntry for govsec.
  assertEquals(calls.length, 0);
  // Coming-soon text sent.
  assert(sent.some((m) => m.kind === "text" && m.body.toLowerCase().includes("coming soon")));
  // Picker re-shown.
  const picker = sent.find((m) => m.kind === "list" && m.rows?.some((r) => r.id === "plat_utt"));
  assert(picker, "platform picker re-rendered after coming-soon message");
});

Deno.test("'nataka kuwekeza' free-text triggers the platform picker", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_sw");
  sent.length = 0;
  await bot.handle(USER, "Nataka kuwekeza");
  const picker = last(sent);
  assertEquals(picker.kind, "list");
  assert(picker.rows?.some((r) => r.id === "plat_utt"));
});

Deno.test("'I want to invest' free-text triggers the platform picker", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  sent.length = 0;
  await bot.handle(USER, "I want to invest");
  const picker = last(sent);
  assertEquals(picker.kind, "list");
  assert(picker.rows?.some((r) => r.id === "plat_dse"));
});

Deno.test("mode_simulation shows a 2-button picker", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  sent.length = 0;
  await bot.handle(USER, "mode_simulation");
  const msg = last(sent);
  assertEquals(msg.kind, "buttons");
  const ids = msg.buttons!.map((b) => b.id);
  assert(ids.includes("sim_growth"));
  assert(ids.includes("sim_challenge"));
});

Deno.test("sim buttons fall back to 'coming soon' when env not set", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_simulation");
  sent.length = 0;
  await bot.handle(USER, "sim_growth");
  const msg = last(sent);
  assertEquals(msg.kind, "text");
  assert(msg.body.toLowerCase().includes("coming soon"));
});

Deno.test("onboarding_done submits lead, sends thanks + feedback prompt", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "onboarding_done", {
    flowData: { scheme: "utt", nida: "123", phone: "255700111222", consent: true },
  });
  // Thank-you text
  assert(sent.some((m) => m.kind === "text" && m.body.toLowerCase().includes("thank")));
  // Feedback prompt (buttons with fb_up / fb_down / go_modes)
  const fb = sent.find((m) => m.kind === "buttons" && m.buttons?.some((b) => b.id === "fb_up"));
  assert(fb, "feedback buttons sent");
});

Deno.test("onboarding failure path shown when flowData missing scheme", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "onboarding_done", { flowData: {} });
  const msg = last(sent);
  assertEquals(msg.kind, "buttons");
  assert(msg.buttons?.some((b) => b.id === "mode_onboarding"), "retry offered");
});

Deno.test("fb_up returns to mode picker", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "onboarding_done", { flowData: { scheme: "dse" } });
  sent.length = 0;
  await bot.handle(USER, "fb_up");
  const picker = sent.find((m) => m.kind === "list");
  assert(picker, "mode picker re-shown after feedback");
  assert(picker!.rows?.some((r) => r.id === "mode_education"));
});

Deno.test("typing 'menu' from anywhere returns to mode picker", async () => {
  const { bot, sent } = setup();
  await bot.handle(USER, "lang_en");
  await bot.handle(USER, "mode_education");
  await bot.handle(USER, "j_learn");
  sent.length = 0;
  await bot.handle(USER, "menu");
  const picker = sent.find((m) => m.kind === "list");
  assert(picker, "mode picker re-shown");
  assert(picker!.rows?.some((r) => r.id === "mode_onboarding"));
});

Deno.test("normalizeLead coerces raw flow response into typed lead", () => {
  const lead = normalizeLead("u", {
    scheme: "utt",
    reg_type: "new",
    reg_category: "individual",
    nida: "  X12345 ",
    phone: "+255700111222",
    consent: "true",
  });
  assertEquals(lead.scheme, "utt");
  assertEquals(lead.reg_type, "new");
  assertEquals(lead.reg_category, "individual");
  assertEquals(lead.nida, "X12345");
  assertEquals(lead.phone, "+255700111222");
  assertEquals(lead.consent, true);
});

Deno.test("resolveOnboardingUrl reads env per scheme", () => {
  Deno.env.set("UTT_ONBOARDING_URL", "https://example.tz/utt");
  try {
    assertEquals(resolveOnboardingUrl("utt"), "https://example.tz/utt");
    assertEquals(resolveOnboardingUrl(null), null);
    assertEquals(resolveOnboardingUrl("dse"), null); // not set
  } finally {
    Deno.env.delete("UTT_ONBOARDING_URL");
  }
});
