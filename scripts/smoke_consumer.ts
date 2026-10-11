// Smoke test for the Consumer-Protection mode's pure functions.
// Runs the four handlers end-to-end against representative inputs and asserts
// the risk band / licence status / format strings come out right.
//
//   deno run --allow-env scripts/smoke_consumer.ts
import {
  formatLicence,
  formatScan,
  scanMessage,
  verifyLicence,
} from "../src/tools/consumer.ts";

let failures = 0;
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("── verifyLicence ──────────────────────────────────────────────");
{
  const r = verifyLicence("UTT AMIS");
  assert(r.status === "licensed" && r.provider?.regulator === "CMSA",
    "exact licensed name → licensed/CMSA", JSON.stringify(r));
}
{
  const r = verifyLicence("crdb");
  assert(r.status === "licensed" && r.provider?.name === "CRDB Bank PLC",
    "alias 'crdb' → CRDB Bank PLC", JSON.stringify(r));
}
{
  const r = verifyLicence("nmb bank");
  assert(r.status === "licensed" && r.provider?.name === "National Microfinance Bank",
    "alias 'nmb bank' → NMB", JSON.stringify(r));
}
{
  const r = verifyLicence("Leo Beneath London");
  assert(r.status === "flagged" && !!r.flaggedReason,
    "known-flagged name → flagged with reason", JSON.stringify(r));
}
{
  const r = verifyLicence("Totally Made Up Capital Partners");
  assert(r.status === "not_found", "unknown name → not_found", JSON.stringify(r));
}
{
  const r = verifyLicence("x"); // too short
  assert(r.status === "not_found", "short query → not_found (safe default)", JSON.stringify(r));
}

console.log("── formatLicence (EN & SW) ────────────────────────────────────");
{
  const r = verifyLicence("DSE");
  const en = formatLicence(r, "en");
  const sw = formatLicence(r, "sw");
  assert(en.includes("✅") && en.includes("licensed list"), "EN licensed string shape");
  assert(sw.includes("✅") && sw.includes("waliosajiliwa"), "SW licensed string shape");
}
{
  const r = verifyLicence("Leo Beneath London");
  const en = formatLicence(r, "en");
  assert(en.includes("⛔") && en.includes("WARNING"), "EN flagged string shape");
}
{
  const r = verifyLicence("Mystery Fund Co");
  const en = formatLicence(r, "en");
  assert(en.includes("⚠️") && en.includes("does NOT mean it is safe"),
    "not_found must NOT imply 'safe'");
}

console.log("── scanMessage ────────────────────────────────────────────────");
{
  const r = scanMessage(
    "URGENT! Guaranteed 100% returns in 7 days. Send 50,000 to 0712345678 to activate your account. Limited slots.",
  );
  assert(r.band === "high" && r.flags.length >= 3,
    `high-risk EN scam → band=high (got band=${r.band}, score=${r.score}, flags=${r.flags.length})`);
}
{
  const r = scanMessage(
    "Faida ya uhakika! Maradufu pesa yako kwa siku 3. Lipa 0712 345 678 ili kuanza. Nafasi chache.",
  );
  assert(r.band === "high", `high-risk SW scam → band=high (got ${r.band}/${r.score})`);
}
{
  const r = scanMessage(
    "Hi, invest 50,000 and I'll show you how to double your money by next month. DM me.",
  );
  assert(r.band === "high" || r.band === "medium",
    `medium/high-risk → not low (got ${r.band}/${r.score})`);
}
{
  const r = scanMessage("Hi, your statement for October is ready. Login at utt-amis.co.tz to view.");
  assert(r.band === "low" || r.band === "medium",
    `benign-ish → low or medium (got ${r.band}/${r.score})`);
}
{
  const r = scanMessage("Join Leo Beneath London for secure returns.");
  assert(r.band === "high" && r.namedFlagged?.name === "Leo Beneath London",
    "mentions a FLAGGED entity → named + high", JSON.stringify(r));
}
{
  const r = scanMessage("");
  assert(r.band === "low" && r.flags.length === 0, "empty text → low/no flags");
}

console.log("── formatScan ────────────────────────────────────────────────");
{
  const r = scanMessage("Guaranteed 100% returns, pay 0712345678 today only!");
  const en = formatScan(r, "en");
  const sw = formatScan(r, "sw");
  assert(en.includes("HIGH RISK") && en.includes("Red flags found:"),
    "EN high-risk card shape");
  assert(sw.includes("HATARI KUBWA") && sw.includes("Dalili zilizoonekana:"),
    "SW high-risk card shape");
  assert(en.includes("guidance, not financial advice"),
    "disclaimer present in EN");
}

console.log("");
console.log(failures === 0
  ? "✅ All consumer-mode smoke checks passed."
  : `❌ ${failures} smoke check(s) failed.`);
Deno.exit(failures === 0 ? 0 : 1);
