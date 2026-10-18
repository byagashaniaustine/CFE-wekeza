// metrics.ts — Supabase-backed counters, histograms, uniques, with an
// in-memory fallback. These tests exercise the fallback (no SUPABASE_URL
// set), which uses the same accumulate/snapshot logic as the Supabase path.

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
import { _resetSupabaseForTests } from "../src/supabase.ts";

function useMemory() {
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("METRICS_ENABLED", "on");
  _resetSupabaseForTests();
  reset();
}

Deno.test("counters increment and are read by snapshot", async () => {
  useMemory();
  messageReceived("255700000001", "en");
  messageReceived("255700000002", "sw");
  messageReceived("255700000001", "en");
  await _flushForTests();

  const snap = await snapshot(1);
  assertEquals(snap.counters[`messages_received_total{lang="en"}`], 2);
  assertEquals(snap.counters[`messages_received_total{lang="sw"}`], 1);
});

Deno.test("addUnique counts distinct users once per day across the window", async () => {
  useMemory();
  messageReceived("255700000010", "en");
  messageReceived("255700000011", "en");
  messageReceived("255700000010", "en"); // repeat
  await _flushForTests();

  const snap = await snapshot(1);
  assertEquals(snap.uniques.users_all_time, 2, "two distinct users counted");
});

Deno.test("observe() routes samples into fixed buckets", async () => {
  useMemory();
  handleLatency(5);     // 10 bucket
  handleLatency(60);    // 100 bucket
  handleLatency(400);   // 500 bucket
  handleLatency(1200);  // 2500 bucket
  handleLatency(45_000); // inf bucket
  await _flushForTests();

  const snap = await snapshot(1);
  const hist = snap.histograms.handle_latency_ms;
  assert(hist, "handle_latency_ms histogram present");
  assertEquals(hist.count, 5);
  assertEquals(hist.buckets["10"], 1);
  assertEquals(hist.buckets["100"], 1);
  assertEquals(hist.buckets["500"], 1);
  assertEquals(hist.buckets["2500"], 1);
  assertEquals(hist.buckets["inf"], 1);
  assert(hist.p50 >= 100 && hist.p50 <= 500, `p50 should be mid-range, got ${hist.p50}`);
  assert(hist.p99 >= 2500, `p99 should hit the slow tail, got ${hist.p99}`);
});

Deno.test("errorRecorded, journeyEntered, languageChosen all land", async () => {
  useMemory();
  languageChosen("sw");
  journeyEntered("learn", "en");
  journeyEntered("quiz", "sw");
  errorRecorded("whatsapp_send", "500");
  await _flushForTests();

  const snap = await snapshot(1);
  assertEquals(snap.counters[`language_chosen_total{lang="sw"}`], 1);
  assertEquals(snap.counters[`journey_entered_total{journey="learn",lang="en"}`], 1);
  assertEquals(snap.counters[`journey_entered_total{journey="quiz",lang="sw"}`], 1);
  assertEquals(snap.counters[`errors_total{code="500",where="whatsapp_send"}`], 1);
});

Deno.test("recorder never throws", () => {
  useMemory();
  Deno.env.set("METRICS_ENABLED", "off");
  // These must not throw even with writes disabled.
  messageSent("text", "en");
  languageChosen("en");
  handleLatency(42);
  assert(true);
  Deno.env.set("METRICS_ENABLED", "on");
});
