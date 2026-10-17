// metrics.ts — KV-backed counters, histograms, uniques.
// Each test opens an isolated in-memory KV so there's no cross-test leakage.

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  _flushForTests,
  errorRecorded,
  handleLatency,
  journeyEntered,
  languageChosen,
  messageReceived,
  messageSent,
  reset,
  snapshot,
} from "../src/metrics.ts";
import { _resetKvCacheForTests } from "../src/kv.ts";

function useMemoryKv() {
  Deno.env.set("KV_PATH", ":memory:");
  Deno.env.set("METRICS_KV", "on");
  _resetKvCacheForTests();
}

Deno.test("counters increment durably and are read by snapshot", async () => {
  useMemoryKv();
  await reset();
  messageReceived("255700000001", "en");
  messageReceived("255700000002", "sw");
  messageReceived("255700000001", "en");
  await _flushForTests();

  const snap = await snapshot(1);
  // messages_received_total with lang label — stored as `metric{labels}`
  const en = snap.counters[`messages_received_total{lang=en}`];
  const sw = snap.counters[`messages_received_total{lang=sw}`];
  assertEquals(en, 2);
  assertEquals(sw, 1);
});

Deno.test("addUnique counts distinct users once per day", async () => {
  useMemoryKv();
  await reset();
  messageReceived("255700000010", "en");
  messageReceived("255700000011", "en");
  messageReceived("255700000010", "en"); // repeat
  await _flushForTests();
  // Second-pass flush — the compare-and-swap in addUnique chains through
  // multiple awaits internally.
  await new Promise((r) => setTimeout(r, 50));

  const snap = await snapshot(1);
  assertEquals(snap.uniques.users_all_time, 2, "two distinct users counted");
});

Deno.test("observe() routes samples into fixed buckets", async () => {
  useMemoryKv();
  await reset();
  handleLatency(5);     // → 10 bucket
  handleLatency(60);    // → 100 bucket
  handleLatency(400);   // → 500 bucket
  handleLatency(1200);  // → 2500 bucket
  handleLatency(45_000); // → inf bucket
  await _flushForTests();
  await new Promise((r) => setTimeout(r, 50));

  const snap = await snapshot(1);
  const hist = snap.histograms.handle_latency_ms;
  assert(hist, "handle_latency_ms histogram present");
  assertEquals(hist.count, 5, "count across buckets");
  assertEquals(hist.buckets["10"], 1);
  assertEquals(hist.buckets["100"], 1);
  assertEquals(hist.buckets["500"], 1);
  assertEquals(hist.buckets["2500"], 1);
  assertEquals(hist.buckets["inf"], 1);
  // p50 falls somewhere between bucket boundaries — just assert it's in the sensible range.
  assert(hist.p50 >= 100 && hist.p50 <= 500, `p50 should be mid-range, got ${hist.p50}`);
  assert(hist.p99 >= 2500, `p99 should hit the slow tail, got ${hist.p99}`);
});

Deno.test("errorRecorded, journeyEntered, languageChosen all land", async () => {
  useMemoryKv();
  await reset();
  languageChosen("sw");
  journeyEntered("learn", "en");
  journeyEntered("quiz", "sw");
  errorRecorded("whatsapp_send", "500");
  await _flushForTests();

  const snap = await snapshot(1);
  assertEquals(snap.counters[`language_chosen_total{lang=sw}`], 1);
  assertEquals(snap.counters[`journey_entered_total{journey=learn,lang=en}`], 1);
  assertEquals(snap.counters[`journey_entered_total{journey=quiz,lang=sw}`], 1);
  assertEquals(snap.counters[`errors_total{code=500,where=whatsapp_send}`], 1);
});

Deno.test("recorder is non-blocking even when KV_PATH is bogus", async () => {
  // Point at an invalid remote URL without a token — openKv() throws at
  // first access. The recorder should NOT propagate the error.
  Deno.env.set("KV_PATH", "https://api.deno.com/databases/bogus/connect");
  Deno.env.delete("DENO_KV_ACCESS_TOKEN");
  _resetKvCacheForTests();

  // These must not throw.
  messageSent("text", "en");
  languageChosen("en");
  handleLatency(42);
  // No await needed — queueMicrotask swallows errors.
  assert(true);

  // Restore so other tests don't inherit this.
  Deno.env.set("KV_PATH", ":memory:");
  _resetKvCacheForTests();
});
