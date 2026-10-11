// Consumer-Protection mode — the scam shield.
//
// A top-level mode (alongside Education / Simulation / Onboarding) offering:
//   • Verify a licence  — is this provider regulated? (answers only from the
//                         CMSA/BoT directory in src/data/providers.ts)
//   • Scan a message    — paste/forward a suspicious SMS or WhatsApp and get a
//                         risk rating (High/Medium/Low) with the red flags found
//   • Scam red flags    — a short, plain-language "how to spot a scam" card
//
// Everything is bilingual (English / Swahili). Nothing here is advice: the scan
// is an INDICATIVE risk signal, never a guarantee, and a licence result that is
// "not found" never means "safe" — it means "verify with the regulator".

import type { Lang } from "../content.ts";
import type { ListRow, Sender } from "../whatsapp.ts";
import { log } from "../logger.ts";
import {
  FLAGGED,
  LICENCE_SOURCE_NOTE_EN,
  LICENCE_SOURCE_NOTE_SW,
  LICENSED,
  type Provider,
} from "../data/providers.ts";

const L = (en: string, sw: string): Record<Lang, string> => ({ en, sw });

// ─── Row ids (consumed by the bot router) ────────────────────────────────────
export const CONSUMER_IDS = {
  verify: "cp_verify",
  scan: "cp_scan",
  tips: "cp_tips",
  back: "go_modes",
} as const;

const T = {
  title: L(
    "Consumer Protection — stay safe from scams. Pick one:",
    "Ulinzi wa Mteja — jilinde na matapeli. Chagua moja:",
  ),
  open: L("Open", "Fungua"),
  verify: L("Verify a licence", "Thibitisha leseni"),
  scan: L("Scan a message", "Chunguza ujumbe"),
  tips: L("Spot a scam", "Tambua utapeli"),
  back: L("Back to modes", "Rudi kwenye hali"),
  askVerify: L(
    "Type the name of the company, fund or scheme and I'll check if it is licensed.",
    "Andika jina la kampuni, mfuko au mpango nami nitaangalia kama ina leseni.",
  ),
  askScan: L(
    "Paste or forward the suspicious message. I'll examine it and rate the risk. (I don't keep the message.)",
    "Bandika au tuma ujumbe wa kutiliwa shaka. Nitauchunguza na kukadiria hatari. (Siuhifadhi ujumbe.)",
  ),
  disclaimer: L(
    "This is guidance, not financial advice, and not a guarantee. When in doubt, don't pay — verify with CMSA (cmsa.go.tz) or BoT (bot.go.tz).",
    "Haya ni mwongozo, si ushauri wa kifedha, wala si uhakika. Ukiwa na shaka, usilipe — thibitisha na CMSA (cmsa.go.tz) au BoT (bot.go.tz).",
  ),
};

// ─── Menu ────────────────────────────────────────────────────────────────────
export async function sendConsumerMenu(to: string, lang: Lang, send: Sender): Promise<void> {
  const rows: ListRow[] = [
    { id: CONSUMER_IDS.verify, title: T.verify[lang] },
    { id: CONSUMER_IDS.scan, title: T.scan[lang] },
    { id: CONSUMER_IDS.tips, title: T.tips[lang] },
    { id: CONSUMER_IDS.back, title: T.back[lang] },
  ];
  await send({ to, kind: "list", body: T.title[lang], listButton: T.open[lang], rows });
}

export async function promptVerify(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: T.askVerify[lang] });
}
export async function promptScan(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: T.askScan[lang] });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · VERIFY A LICENCE
// ═══════════════════════════════════════════════════════════════════════════

export type LicenceStatus = "licensed" | "flagged" | "not_found";
export interface LicenceResult {
  status: LicenceStatus;
  provider?: Provider;
  flaggedReason?: { en: string; sw: string };
  query: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\b(ltd|limited|plc|co|company|inc)\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function hit(haystackNames: string[], q: string): boolean {
  const nq = norm(q);
  if (nq.length < 3) return false;
  return haystackNames.some((n) => {
    const nn = norm(n);
    return nn.length >= 3 && (nn.includes(nq) || nq.includes(nn));
  });
}

/** Look a name up against the directory. Never asserts "safe" on not_found. */
export function verifyLicence(query: string): LicenceResult {
  const q = (query || "").trim();
  // flagged / known-unlicensed first
  for (const f of FLAGGED) {
    if (hit([f.name, ...(f.aka ?? [])], q)) {
      return { status: "flagged", flaggedReason: { en: f.reasonEn, sw: f.reasonSw }, query: q };
    }
  }
  for (const p of LICENSED) {
    if (hit([p.name, ...(p.aka ?? [])], q)) return { status: "licensed", provider: p, query: q };
  }
  return { status: "not_found", query: q };
}

export function formatLicence(res: LicenceResult, lang: Lang): string {
  const note = lang === "sw" ? LICENCE_SOURCE_NOTE_SW : LICENCE_SOURCE_NOTE_EN;
  if (res.status === "licensed") {
    const p = res.provider!;
    const cat = lang === "sw" ? p.categorySw : p.category;
    const head = lang === "sw"
      ? `✅ *${p.name}* ipo kwenye orodha ya waliosajiliwa (${p.regulator}).`
      : `✅ *${p.name}* is on the licensed list (${p.regulator}).`;
    const body = lang === "sw" ? `Aina: ${cat}.` : `Type: ${cat}.`;
    return `${head}\n${body}\n\n${note}\n\n${T.disclaimer[lang]}`;
  }
  if (res.status === "flagged") {
    const r = lang === "sw" ? res.flaggedReason!.sw : res.flaggedReason!.en;
    const head = lang === "sw"
      ? `⛔ *${res.query}* — ONYO. Haipo kwenye orodha ya waliosajiliwa.`
      : `⛔ *${res.query}* — WARNING. Not on the licensed list.`;
    return `${head}\n${r}\n\n${T.disclaimer[lang]}`;
  }
  // not_found — explicitly NOT "safe"
  const head = lang === "sw"
    ? `⚠️ Sikuipata *${res.query}* kwenye orodha yangu. Hii HAIMAANISHI ni salama.`
    : `⚠️ I couldn't find *${res.query}* in my directory. This does NOT mean it is safe.`;
  const body = lang === "sw"
    ? "Thibitisha moja kwa moja na msimamizi kabla ya kulipa chochote."
    : "Verify directly with the regulator before paying anything.";
  return `${head}\n${body}\n\n${note}\n\n${T.disclaimer[lang]}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · SCAN A MESSAGE  (red-flag heuristics + directory cross-check → scoring)
// ═══════════════════════════════════════════════════════════════════════════

interface Flag {
  code: string;
  test: RegExp;
  weight: number;
  en: string;
  sw: string;
}

// Red flags cover both English and Swahili wording seen in local scams.
const FLAGS: Flag[] = [
  { code: "guaranteed", weight: 3, test: /\b(guarantee[d]?|100%|no risk|risk[- ]free)\b|faida ya uhakika|hakuna hasara|uhakika wa faida/i,
    en: "Promises guaranteed / risk-free returns", sw: "Inaahidi faida ya uhakika / bila hasara" },
  { code: "double", weight: 3, test: /\b(double|triple|2x|3x|x2|x3)\b|maradufu|ongeza mara mbili/i,
    en: "Promises to multiply your money", sw: "Inaahidi kuzidisha pesa yako" },
  { code: "highpct", weight: 2, test: /\b([3-9]\d|\d{3,})\s?%/,
    en: "Unusually high percentage return", sw: "Asilimia ya faida kubwa isiyo ya kawaida" },
  { code: "fastreturn", weight: 2, test: /\b(per day|daily|a day|in \d+ (day|days|hour|hours|week)|kila siku|kwa siku|ndani ya (siku|saa))\b/i,
    en: "Returns 'per day' or in a few days", sw: "Faida 'kwa siku' au ndani ya siku chache" },
  { code: "recruit", weight: 2, test: /\b(refer|recruit|downline|invite .*(earn|bonus)|network marketing)\b|lete watu|mleta|kuleta wanachama|jiunge .*(kikundi|group)/i,
    en: "Asks you to recruit or refer others (pyramid)", sw: "Inakutaka uwalete wengine (piramidi)" },
  { code: "paymobile", weight: 2, test: /\b(lipa|tuma|send|pay).{0,20}(0[67]\d{7,8}|\+?2557\d{8})/i,
    en: "Asks you to pay a personal mobile number", sw: "Inakutaka ulipe namba binafsi ya simu" },
  { code: "fee", weight: 3, test: /\b(facilitation|release|clearing|processing|activation) fee\b|ada ya (kutoa|kufungua|usajili)|lipia ili (kupata|kutoa)/i,
    en: "Asks for a fee to release / unlock funds", sw: "Inaomba ada ili kutoa / kufungua fedha" },
  { code: "fakepay", weight: 3, test: /\b(swift|credit advice|payment confirmation|you have received|transfer confirmation)\b|umepokea (pesa|malipo)|uthibitisho wa malipo/i,
    en: "Fake payment / transfer confirmation", sw: "Uthibitisho wa malipo wa kughushi" },
  { code: "urgency", weight: 1, test: /\b(urgent|today only|act now|limited (slots|time)|expires|hurry)\b|haraka|leo tu|nafasi chache|zimebaki|muda unaisha/i,
    en: "Creates false urgency", sw: "Inatengeneza uharaka wa uongo" },
  { code: "crypto", weight: 1, test: /\b(bitcoin|crypto|usdt|forex|binance|trading bot|mining)\b/i,
    en: "Crypto / forex 'investment' offer", sw: "Ofa ya 'uwekezaji' wa crypto / forex" },
  { code: "falsereg", weight: 2, test: /\b(bot|cmsa|government|serikali)\b.{0,20}\b(approved|licen[sc]ed|registered|imeidhinishwa|imesajiliwa)\b/i,
    en: "Falsely claims to be government / regulator approved", sw: "Inadai uongo kuidhinishwa na serikali / msimamizi" },
  { code: "link", weight: 1, test: /(bit\.ly|tinyurl|t\.me|wa\.me|chat\.whatsapp|https?:\/\/\S+)/i,
    en: "Contains a link to click", sw: "Ina kiungo cha kubofya" },
  { code: "upatu", weight: 2, test: /\bupatu\b|mchezo wa kuchangiana|kutunza pesa kimtandao/i,
    en: "Informal / unlicensed savings scheme (upatu)", sw: "Mpango usio rasmi wa kuweka akiba (upatu)" },
];

export type RiskBand = "high" | "medium" | "low";
export interface ScanResult {
  band: RiskBand;
  score: number;
  flags: { code: string; en: string; sw: string }[];
  namedFlagged?: { name: string; en: string; sw: string };
}

/** Examine a message and return an indicative risk rating with the flags found. */
export function scanMessage(text: string): ScanResult {
  const t = (text || "").slice(0, 2000);
  const flags: { code: string; en: string; sw: string }[] = [];
  let score = 0;
  for (const f of FLAGS) {
    if (f.test.test(t)) { score += f.weight; flags.push({ code: f.code, en: f.en, sw: f.sw }); }
  }
  // cross-check named entities against the known-unlicensed list
  let namedFlagged: ScanResult["namedFlagged"];
  for (const fl of FLAGGED) {
    if ([fl.name, ...(fl.aka ?? [])].some((n) => t.toLowerCase().includes(n.toLowerCase()))) {
      score += 5;
      namedFlagged = { name: fl.name, en: fl.reasonEn, sw: fl.reasonSw };
      break;
    }
  }
  const band: RiskBand = score >= 5 ? "high" : score >= 2 ? "medium" : "low";
  return { band, score, flags, namedFlagged };
}

const BAND = {
  high: L("🔴 HIGH RISK — this looks like a scam.", "🔴 HATARI KUBWA — huu unaonekana kama utapeli."),
  medium: L("🟠 MEDIUM RISK — be very careful.", "🟠 HATARI YA WASTANI — kuwa makini sana."),
  low: L("🟢 LOW RISK — no obvious red flags, but still verify.", "🟢 HATARI NDOGO — hakuna dalili za wazi, lakini bado thibitisha."),
};
const ADVICE = {
  high: L("Do not pay or share any details. Report it and verify with CMSA/BoT.",
    "Usilipe wala kutoa taarifa zozote. Ripoti na thibitisha na CMSA/BoT."),
  medium: L("Don't pay yet. Verify the provider's licence before doing anything.",
    "Usilipe bado. Thibitisha leseni ya mtoa huduma kabla ya kufanya lolote."),
  low: L("Still confirm the provider is licensed before sending money.",
    "Bado thibitisha mtoa huduma ana leseni kabla ya kutuma pesa."),
};

export function formatScan(res: ScanResult, lang: Lang): string {
  const lines: string[] = [BAND[res.band][lang]];
  if (res.namedFlagged) {
    lines.push("");
    lines.push(lang === "sw"
      ? `⛔ Imetajwa *${res.namedFlagged.name}*: ${res.namedFlagged.sw}`
      : `⛔ Mentions *${res.namedFlagged.name}*: ${res.namedFlagged.en}`);
  }
  if (res.flags.length) {
    lines.push("");
    lines.push(lang === "sw" ? "Dalili zilizoonekana:" : "Red flags found:");
    for (const f of res.flags) lines.push(`• ${lang === "sw" ? f.sw : f.en}`);
  } else if (!res.namedFlagged) {
    lines.push("");
    lines.push(lang === "sw" ? "Sikuona dalili za wazi za utapeli." : "I didn't spot obvious scam signals.");
  }
  lines.push("");
  lines.push(`➡️ ${ADVICE[res.band][lang]}`);
  lines.push("");
  lines.push(T.disclaimer[lang]);
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · SPOT-A-SCAM CARD
// ═══════════════════════════════════════════════════════════════════════════
const TIPS = L(
  "How to spot a scam:\n• Guaranteed or 'double your money' returns\n• Pressure to pay a fee to 'release' funds\n• Pay to a personal mobile number\n• Asked to recruit others to earn\n• No CMSA/BoT licence\n\nReal investing has risk and no guarantees. Verify every provider before paying.",
  "Jinsi ya kutambua utapeli:\n• Faida ya uhakika au 'kuzidisha pesa'\n• Shinikizo la kulipa ada ili 'kutoa' fedha\n• Kulipa namba binafsi ya simu\n• Kuombwa kuwaleta wengine ili upate\n• Hakuna leseni ya CMSA/BoT\n\nUwekezaji halisi una hatari na hauna uhakika. Thibitisha kila mtoa huduma kabla ya kulipa.",
);
export async function sendTips(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: `${TIPS[lang]}\n\n${T.disclaimer[lang]}` });
}

// ─── High-level handlers the bot router can call ─────────────────────────────
export async function replyVerify(to: string, lang: Lang, query: string, send: Sender): Promise<void> {
  const res = verifyLicence(query);
  log("ROUTE", { mode: "consumer", action: "verify", status: res.status });
  await send({ to, kind: "text", body: formatLicence(res, lang) });
}
export async function replyScan(to: string, lang: Lang, message: string, send: Sender): Promise<void> {
  const res = scanMessage(message);
  log("ROUTE", { mode: "consumer", action: "scan", band: res.band, score: res.score });
  await send({ to, kind: "text", body: formatScan(res, lang) });
}
