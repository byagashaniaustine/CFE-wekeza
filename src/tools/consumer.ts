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
import * as metrics from "../metrics.ts";
import { recordScamReport } from "../recorder.ts";
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
  report: "cp_report",
  back: "go_modes",
} as const;

// Button ids used inside the BoT escalation (report-a-problem) funnel.
export const REPORT_IDS = {
  fspYes: "cpr_fsp_yes",
  fspNo: "cpr_fsp_no",
  daysYes: "cpr_days_yes",
  daysNo: "cpr_days_no",
  cancel: "cpr_cancel",
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
  report: L("Report a problem", "Ripoti tatizo"),
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

  // ─── Report-a-problem funnel copy ────────────────────────────────────────
  // BoT's own rule: the complainant must contact the FSP first and wait up to
  // 14 working days for a response before escalating to BoT. The bot enforces
  // both gates in copy, then collects the three facts BoT needs on a complaint
  // (provider, issue, FSP response) and stamps a row for ops triage.
  reportFspTitle: L(
    "Before BoT can act on a complaint, you must first raise it with your bank, SACCOS, microfinance or mobile-money provider. Have you already contacted them?",
    "Kabla BoT haijashughulikia malalamiko, lazima uwe umeyapeleka kwanza kwa benki, SACCOS, mikopo midogo au mtoa huduma wa pesa za simu. Je, tayari umewasiliana nao?",
  ),
  reportYes: L("Yes", "Ndiyo"),
  reportNo: L("No", "Hapana"),
  reportCancel: L("Cancel", "Ghairi"),
  reportFspFirst: L(
    "Please contact your provider first and keep the reference number, the date, and any reply they give you. If they do not resolve it within 14 days, come back and I will help you escalate to BoT.",
    "Tafadhali wasiliana na mtoa huduma wako kwanza na uhifadhi namba ya rejea, tarehe na jibu lolote. Wasipotatua ndani ya siku 14, rudi nami nitakusaidia kupeleka BoT.",
  ),
  reportDaysTitle: L(
    "Has it been at least 14 working days since you contacted the provider without a resolution?",
    "Je, imepita angalau siku 14 za kazi tangu uwasiliane na mtoa huduma bila kupata majibu?",
  ),
  reportWaitMore: L(
    "Thanks — give the provider the full 14 working days to respond, then come back and I will help you escalate to BoT.",
    "Asante — mpe mtoa huduma siku kamili 14 za kazi kujibu, kisha urudi nami nitakusaidia kupeleka BoT.",
  ),
  reportAskProvider: L(
    "Which provider is the complaint about? Type the full name (for example: CRDB Bank, Tigo Pesa, M-Koba).",
    "Lalamiko ni kuhusu mtoa huduma yupi? Andika jina kamili (mfano: CRDB Bank, Tigo Pesa, M-Koba).",
  ),
  reportAskIssue: L(
    "In one or two sentences, what happened? Include the date, the amount and any reference number you have.",
    "Kwa sentensi moja au mbili, nini kilitokea? Taja tarehe, kiasi na namba yoyote ya rejea uliyonayo.",
  ),
  reportAskResponse: L(
    "What did the provider say when you contacted them? If they did not reply, type \"no response\".",
    "Mtoa huduma alijibu nini ulipowasiliana nao? Kama hawakujibu, andika \"hakuna jibu\".",
  ),
  reportCancelled: L(
    "Report cancelled. You can start again any time from the Consumer Protection menu.",
    "Ripoti imeghairiwa. Unaweza kuanza tena wakati wowote kutoka kwenye menyu ya Ulinzi wa Mteja.",
  ),
  reportSubmitted: L(
    "Thank you — your complaint has been recorded and shared with our ops team to help you follow up with BoT.\n\nYou can also contact BoT directly:\n- Website: bot.go.tz\n- Email: botcommunications@bot.go.tz\n- Hotline: +255 22 223 3271 / 0800 110 046\n\nKeep every message and payment slip. This is guidance, not legal advice.",
    "Asante — lalamiko lako limerekodiwa na limetumwa kwa timu yetu ili kukusaidia kufuatilia na BoT.\n\nUnaweza pia kuwasiliana na BoT moja kwa moja:\n- Tovuti: bot.go.tz\n- Barua pepe: botcommunications@bot.go.tz\n- Simu: +255 22 223 3271 / 0800 110 046\n\nHifadhi kila ujumbe na risiti ya malipo. Huu ni mwongozo, siyo ushauri wa kisheria.",
  ),
};

// ─── Menu ────────────────────────────────────────────────────────────────────
export async function sendConsumerMenu(to: string, lang: Lang, send: Sender): Promise<void> {
  const rows: ListRow[] = [
    { id: CONSUMER_IDS.verify, title: T.verify[lang] },
    { id: CONSUMER_IDS.scan, title: T.scan[lang] },
    { id: CONSUMER_IDS.tips, title: T.tips[lang] },
    { id: CONSUMER_IDS.report, title: T.report[lang] },
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

// ─── Report-a-problem senders ────────────────────────────────────────────────
// Each step renders yes/no (or just cancel) as buttons rather than list rows so
// the user can tap through quickly on mobile; the bot router state-gates the
// button ids so a stray tap outside the flow is ignored.
export async function promptReportFspCheck(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({
    to,
    kind: "buttons",
    body: T.reportFspTitle[lang],
    buttons: [
      { id: REPORT_IDS.fspYes, title: T.reportYes[lang] },
      { id: REPORT_IDS.fspNo, title: T.reportNo[lang] },
      { id: REPORT_IDS.cancel, title: T.reportCancel[lang] },
    ],
  });
}
export async function promptReportDaysCheck(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({
    to,
    kind: "buttons",
    body: T.reportDaysTitle[lang],
    buttons: [
      { id: REPORT_IDS.daysYes, title: T.reportYes[lang] },
      { id: REPORT_IDS.daysNo, title: T.reportNo[lang] },
      { id: REPORT_IDS.cancel, title: T.reportCancel[lang] },
    ],
  });
}
export async function promptReportProvider(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: T.reportAskProvider[lang] });
}
export async function promptReportIssue(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: T.reportAskIssue[lang] });
}
export async function promptReportResponse(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: T.reportAskResponse[lang] });
}
export async function sendReportFspFirstGuidance(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: T.reportFspFirst[lang] });
}
export async function sendReportWaitPeriodGuidance(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: T.reportWaitMore[lang] });
}
export async function sendReportSubmitted(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: T.reportSubmitted[lang] });
}
export async function sendReportCancelled(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: T.reportCancelled[lang] });
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
  metrics.licenceCheck(res.status, lang);
  await send({ to, kind: "text", body: formatLicence(res, lang) });
}
export async function replyScan(to: string, lang: Lang, message: string, send: Sender): Promise<void> {
  const res = scanMessage(message);
  log("ROUTE", { mode: "consumer", action: "scan", band: res.band, score: res.score });
  metrics.scamScan(res.band, lang);
  // Only medium / high are worth a row in cfe_scam_reports — low-risk pastes
  // are noise. Entity is the named-flagged provider when we matched one,
  // otherwise a short redacted preview.
  if (res.band !== "low") {
    const entity = res.namedFlagged?.name
      ?? (message || "").slice(0, 80).replace(/\s+/g, " ").trim()
      ?? "unknown";
    recordScamReport({
      entity,
      flags: res.flags.map((f) => f.code),
      risk: res.band,
    });
  }
  await send({ to, kind: "text", body: formatScan(res, lang) });
}
