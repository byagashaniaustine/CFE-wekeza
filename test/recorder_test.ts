// recorder.ts — row-per-event writers backing the dashboard's live panels.
// These tests exercise the in-memory fallback (no SUPABASE_URL set).

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  _flushForTests,
  _resetForTests,
  _snapshotForTests,
  recordAiTurn,
  recordHitl,
  recordScamReport,
  redactPhone,
} from "../src/recorder.ts";
import { estimateConfidence } from "../src/llm.ts";
import { _resetSupabaseForTests } from "../src/supabase.ts";

function useMemory() {
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("RECORDER_ENABLED", "on");
  _resetSupabaseForTests();
  _resetForTests();
}

Deno.test("redactPhone strips local 07/06 and international +255 numbers", () => {
  assertEquals(redactPhone("call me on 0712345678 please").text, "call me on [phone] please");
  assertEquals(redactPhone("call me on 0612345678 please").text, "call me on [phone] please");
  assertEquals(redactPhone("send to +255712345678 now").text, "send to [phone] now");
  assertEquals(redactPhone("send to 255712345678 now").text, "send to [phone] now");
  assertEquals(redactPhone("no phone here").text, "no phone here");
  assertEquals(redactPhone("call me on 0712345678").didRedact, true);
  assertEquals(redactPhone("no phone here").didRedact, false);
});

Deno.test("recordAiTurn stores a row with redaction flag and defaults", async () => {
  useMemory();
  recordAiTurn({
    userId: "255700000001",
    lang: "en",
    intent: "qa",
    input: "What is UTT? Call 0712345678",
    output: "UTT is a unit trust…",
    provider: "claude",
    latencyMs: 1234.6,
  });
  await _flushForTests();

  const rows = _snapshotForTests().ai;
  assertEquals(rows.length, 1);
  const r = rows[0];
  assertEquals(r.input, "What is UTT? Call [phone]");
  assertEquals(r.redact_phone, true);
  assertEquals(r.provider, "claude");
  assertEquals(r.latency_ms, 1235);                    // rounded
  assertEquals(r.action, "auto");                      // default
  assertEquals(r.intent, "qa");
  assertEquals(r.handle_latency_ms, null);
});

Deno.test("recordScamReport returns an id with scam_ prefix and inserts awaiting", async () => {
  useMemory();
  const id = recordScamReport({
    entity: "QuickRich Investments",
    flags: ["guaranteed", "recruit"],
    risk: "high",
  });
  await _flushForTests();

  assert(id.startsWith("scam_"));
  const rows = _snapshotForTests().scams;
  assertEquals(rows.length, 1);
  assertEquals(rows[0].id, id);
  assertEquals(rows[0].entity, "QuickRich Investments");
  assertEquals(rows[0].flags, "guaranteed,recruit");
  assertEquals(rows[0].risk, "high");
  assertEquals(rows[0].status, "awaiting");
});

Deno.test("recordHitl returns an id with hitl_ prefix and inserts open", async () => {
  useMemory();
  const id = recordHitl({
    kind: "escalation",
    tag: "Scam HIGH",
    title: "HIGH-risk scan: QuickRich",
    sub: "flags: guaranteed,recruit",
    slaLabel: "30m SLA",
  });
  await _flushForTests();

  assert(id.startsWith("hitl_"));
  const rows = _snapshotForTests().hitl;
  assertEquals(rows.length, 1);
  assertEquals(rows[0].id, id);
  assertEquals(rows[0].kind, "escalation");
  assertEquals(rows[0].tag, "Scam HIGH");
  assertEquals(rows[0].status, "open");
  assertEquals(rows[0].sla_label, "30m SLA");
});

Deno.test("estimateConfidence: empty/short output floors at 0.20", () => {
  assertEquals(estimateConfidence("claude", ""), 0.20);
  assertEquals(estimateConfidence("claude", "ok."), 0.20);
  assertEquals(estimateConfidence("gemini", "hi"), 0.20);
});

Deno.test("estimateConfidence: uncertain-answer templates floor at 0.35", () => {
  assertEquals(estimateConfidence("claude", "I don't know what UTT means, sorry."), 0.35);
  assertEquals(estimateConfidence("claude", "I only cover Tanzania financial literacy topics."), 0.35);
  assertEquals(estimateConfidence("gemini", "Sijui jibu la swali hilo kwa sasa."), 0.35);
});

Deno.test("estimateConfidence: Claude baseline > Gemini baseline", () => {
  const good = "UTT AMIS is Tanzania's largest unit trust manager, offering several bilateral funds.";
  const c = estimateConfidence("claude", good);
  const g = estimateConfidence("gemini", good);
  assert(c > g, `expected claude confidence > gemini (${c} vs ${g})`);
  assert(c >= 0.85, `claude baseline too low: ${c}`);
});

Deno.test("estimateConfidence: fallback penalty applies when Gemini served after Claude failed", () => {
  const good = "UTT AMIS is Tanzania's largest unit trust manager, offering several bilateral funds.";
  const direct = estimateConfidence("gemini", good);
  const fallback = estimateConfidence("gemini", good, { fallback: true });
  assert(fallback < direct, `fallback should cost confidence (${fallback} vs direct ${direct})`);
});

Deno.test("RECORDER_ENABLED=off disables writes", async () => {
  useMemory();
  Deno.env.set("RECORDER_ENABLED", "off");
  recordAiTurn({ userId: "u", lang: "en", input: "hi", output: "hey" });
  recordScamReport({ entity: "x", flags: [], risk: "low" });
  recordHitl({ kind: "escalation", tag: "x", title: "y" });
  await _flushForTests();

  const snap = _snapshotForTests();
  assertEquals(snap.ai.length, 0);
  assertEquals(snap.scams.length, 0);
  assertEquals(snap.hitl.length, 0);
  Deno.env.set("RECORDER_ENABLED", "on");
});
