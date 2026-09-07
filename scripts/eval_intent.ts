// Evaluates src/tools/intent.ts against 100 hand-labeled messages.
//
// Run with:
//   deno run --allow-env --allow-net --env scripts/eval_intent.ts
//
// Prints per-bucket accuracy, a confusion matrix, and lists every mismatch
// so the system prompt in src/tools/intent.ts can be tuned.

import { classifyIntent, type Intent } from "../src/tools/intent.ts";

type Lang = "en" | "sw";
interface Case { text: string; expected: Intent; lang: Lang }

const cases: Case[] = [
  // ── ONBOARD (30) ───────────────────────────────────────────────────────────
  { text: "I want to invest", expected: "onboard", lang: "en" },
  { text: "How do I start investing?", expected: "onboard", lang: "en" },
  { text: "Sign me up for UTT", expected: "onboard", lang: "en" },
  { text: "Nataka kuwekeza", expected: "onboard", lang: "sw" },
  { text: "Nisaidie kuanza kuwekeza", expected: "onboard", lang: "sw" },
  { text: "Help me open an investment account", expected: "onboard", lang: "en" },
  { text: "I'm ready to put my money in", expected: "onboard", lang: "en" },
  { text: "Where do I register?", expected: "onboard", lang: "en" },
  { text: "Nianze vipi kuwekeza?", expected: "onboard", lang: "sw" },
  { text: "Nataka kufungua akaunti ya uwekezaji", expected: "onboard", lang: "sw" },
  { text: "Let me start", expected: "onboard", lang: "en" },
  { text: "Nataka DSE", expected: "onboard", lang: "sw" },
  { text: "I want to buy shares", expected: "onboard", lang: "en" },
  { text: "Nataka kununua hisa", expected: "onboard", lang: "sw" },
  { text: "Enroll me", expected: "onboard", lang: "en" },
  { text: "Naomba unisajili", expected: "onboard", lang: "sw" },
  { text: "I'll invest now", expected: "onboard", lang: "en" },
  { text: "Nataka kuweka pesa kwenye UTT", expected: "onboard", lang: "sw" },
  { text: "Start me off with treasury bonds", expected: "onboard", lang: "en" },
  { text: "Show me how to sign up", expected: "onboard", lang: "en" },
  { text: "Nataka kuanza kuweka akaunti", expected: "onboard", lang: "sw" },
  { text: "Open my UTT account", expected: "onboard", lang: "en" },
  { text: "Fungulia akaunti ya uwekezaji", expected: "onboard", lang: "sw" },
  { text: "I need to invest my savings", expected: "onboard", lang: "en" },
  { text: "How can I begin investing?", expected: "onboard", lang: "en" },
  { text: "Ready to start", expected: "onboard", lang: "en" },
  { text: "Nianze usajili", expected: "onboard", lang: "sw" },
  { text: "Nataka kununua bond", expected: "onboard", lang: "sw" },
  { text: "Let's do this — I want in", expected: "onboard", lang: "en" },
  { text: "Registration please", expected: "onboard", lang: "en" },

  // ── SIMULATION (30) — safety, past performance, "what if" ──────────────────
  { text: "Is my money safe?", expected: "simulation", lang: "en" },
  { text: "Will I lose everything?", expected: "simulation", lang: "en" },
  { text: "Najuaje sitopata hasara?", expected: "simulation", lang: "sw" },
  { text: "Pesa zangu ni salama?", expected: "simulation", lang: "sw" },
  { text: "How safe is DSE?", expected: "simulation", lang: "en" },
  { text: "What if the market crashes?", expected: "simulation", lang: "en" },
  { text: "Show me proof that this works", expected: "simulation", lang: "en" },
  { text: "Onyesha ushahidi wa ukuaji", expected: "simulation", lang: "sw" },
  { text: "How has UTT performed in the past?", expected: "simulation", lang: "en" },
  { text: "Kama ningewekeza mwaka jana, ningepata nini?", expected: "simulation", lang: "sw" },
  { text: "Prove the returns are real", expected: "simulation", lang: "en" },
  { text: "Naogopa kupoteza pesa", expected: "simulation", lang: "sw" },
  { text: "I'm scared of losing money", expected: "simulation", lang: "en" },
  { text: "What returns can I actually expect?", expected: "simulation", lang: "en" },
  { text: "Onyesha mifano ya faida halisi", expected: "simulation", lang: "sw" },
  { text: "Give me evidence it works", expected: "simulation", lang: "en" },
  { text: "Naogopa kuwekeza", expected: "simulation", lang: "sw" },
  { text: "How risky is investing?", expected: "simulation", lang: "en" },
  { text: "Kuna hatari gani?", expected: "simulation", lang: "sw" },
  { text: "Show me the past prices", expected: "simulation", lang: "en" },
  { text: "Ninataka kujaribu bila hatari", expected: "simulation", lang: "sw" },
  { text: "I want to try without risking money", expected: "simulation", lang: "en" },
  { text: "Kuna simulation ninaweza kucheza?", expected: "simulation", lang: "sw" },
  { text: "Give me a demo first", expected: "simulation", lang: "en" },
  { text: "Wapi ninaweza kuona ukuaji wa hisa?", expected: "simulation", lang: "sw" },
  { text: "Show me the growth chart", expected: "simulation", lang: "en" },
  { text: "How much would I have if I'd invested 5 years ago?", expected: "simulation", lang: "en" },
  { text: "What if I'd bought CRDB shares in 2018?", expected: "simulation", lang: "en" },
  { text: "Ninajuaje kama ni salama?", expected: "simulation", lang: "sw" },
  { text: "Prove that the market actually grows", expected: "simulation", lang: "en" },

  // ── ASK (20) — concept / definition questions ──────────────────────────────
  { text: "What is UTT?", expected: "ask", lang: "en" },
  { text: "How do bonds work?", expected: "ask", lang: "en" },
  { text: "What is diversification?", expected: "ask", lang: "en" },
  { text: "P/E ratio ni nini?", expected: "ask", lang: "sw" },
  { text: "Explain unit trusts", expected: "ask", lang: "en" },
  { text: "Hatifungani ni nini?", expected: "ask", lang: "sw" },
  { text: "What's the difference between shares and bonds?", expected: "ask", lang: "en" },
  { text: "How does the DSE work?", expected: "ask", lang: "en" },
  { text: "Tofauti ya hisa na hatifungani ni nini?", expected: "ask", lang: "sw" },
  { text: "What is NAV in a unit trust?", expected: "ask", lang: "en" },
  { text: "Define compound interest", expected: "ask", lang: "en" },
  { text: "Riba ya jumla ni nini?", expected: "ask", lang: "sw" },
  { text: "How are dividends paid?", expected: "ask", lang: "en" },
  { text: "Gawio linalipwaje?", expected: "ask", lang: "sw" },
  { text: "What is CMSA?", expected: "ask", lang: "en" },
  { text: "Explain the difference between saving and investing", expected: "ask", lang: "en" },
  { text: "Kuweka akiba na kuwekeza tofauti ni nini?", expected: "ask", lang: "sw" },
  { text: "What does IPO mean?", expected: "ask", lang: "en" },
  { text: "What is a stockbroker?", expected: "ask", lang: "en" },
  { text: "Dalali wa hisa ni nani?", expected: "ask", lang: "sw" },

  // ── UNKNOWN (20) — greetings, thanks, ambiguous ────────────────────────────
  { text: "Thanks", expected: "unknown", lang: "en" },
  { text: "OK", expected: "unknown", lang: "en" },
  { text: "Sawa", expected: "unknown", lang: "sw" },
  { text: "Asante", expected: "unknown", lang: "sw" },
  { text: "Bye", expected: "unknown", lang: "en" },
  { text: "Cool", expected: "unknown", lang: "en" },
  { text: "Great", expected: "unknown", lang: "en" },
  { text: "Nzuri", expected: "unknown", lang: "sw" },
  { text: "Hmm", expected: "unknown", lang: "en" },
  { text: "?", expected: "unknown", lang: "en" },
  { text: "Yes", expected: "unknown", lang: "en" },
  { text: "Ndiyo", expected: "unknown", lang: "sw" },
  { text: "No", expected: "unknown", lang: "en" },
  { text: "Hapana", expected: "unknown", lang: "sw" },
  { text: "Alright", expected: "unknown", lang: "en" },
  { text: "Sawasawa", expected: "unknown", lang: "sw" },
  { text: "I don't know", expected: "unknown", lang: "en" },
  { text: "Never mind", expected: "unknown", lang: "en" },
  { text: "Not sure", expected: "unknown", lang: "en" },
  { text: "Kesho", expected: "unknown", lang: "sw" },
];

// Concurrency limiter so we don't hammer the API and hit rate limits.
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// Silence the classifier's own log() output for the eval — only the final
// summary matters. The classifier writes JSON lines to stdout via logger.ts;
// wrap console.log so those lines are dropped during the run.
const origLog = console.log;
const captured: string[] = [];
console.log = (...args: unknown[]) => {
  const s = args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
  if (s.startsWith("{") && s.includes('"category"')) captured.push(s);
  else origLog(...args);
};

origLog(`Running intent classifier over ${cases.length} cases…`);
const started = performance.now();

const outcomes = await runWithConcurrency(cases, 8, async (c, i) => {
  const r = await classifyIntent(c.text, c.lang);
  if ((i + 1) % 10 === 0) origLog(`  ${i + 1}/${cases.length}`);
  return { ...c, got: r.intent, confident: r.confident };
});

console.log = origLog;
const ms = Math.round(performance.now() - started);

// ── Report ──────────────────────────────────────────────────────────────────
const buckets: Intent[] = ["onboard", "simulation", "ask", "unknown"];
const total = outcomes.length;
const correct = outcomes.filter((o) => o.got === o.expected).length;

console.log(`\nCompleted in ${(ms / 1000).toFixed(1)}s`);
console.log(`Overall accuracy: ${correct}/${total} (${((100 * correct) / total).toFixed(1)}%)\n`);

console.log("Per-bucket accuracy:");
for (const b of buckets) {
  const bucket = outcomes.filter((o) => o.expected === b);
  const hit = bucket.filter((o) => o.got === b).length;
  const pct = bucket.length ? ((100 * hit) / bucket.length).toFixed(1) : "—";
  console.log(`  ${b.padEnd(11)} ${hit}/${bucket.length} (${pct}%)`);
}

console.log("\nConfusion matrix (rows = expected, cols = got):");
const header = "expected \\ got".padEnd(15) + buckets.map((b) => b.padEnd(11)).join("");
console.log("  " + header);
for (const exp of buckets) {
  const row = exp.padEnd(15) + buckets.map((got) => {
    const n = outcomes.filter((o) => o.expected === exp && o.got === got).length;
    return String(n).padEnd(11);
  }).join("");
  console.log("  " + row);
}

const mismatches = outcomes.filter((o) => o.got !== o.expected);
if (mismatches.length) {
  console.log(`\nMismatches (${mismatches.length}):`);
  for (const m of mismatches) {
    console.log(`  [expected=${m.expected.padEnd(10)} got=${m.got.padEnd(10)}] (${m.lang}) "${m.text}"`);
  }
}
