// Tool 1: Language detector.
// Identifies whether the user is writing in Kiswahili or English so that every
// subsequent response is delivered in the same language without asking the user
// to pick one manually.
//
// Pipeline:
//   1. Fast keyword scan  → returns immediately for clear cases (no API call)
//   2. Claude Haiku call  → for short / ambiguous messages
//   3. Fallback           → returns { confident: false } so the caller can show
//                           the manual language picker instead

import Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "./content.ts";
import { log } from "./logger.ts";

const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
// deno-lint-ignore no-explicit-any
const haiku: any = apiKey ? new Anthropic({ apiKey }) : null;

// ─── Keyword tables ───────────────────────────────────────────────────────────

// Swahili words that almost never appear in English text
const SW_TOKENS = new Set([
  "habari", "Niambie","Nambie","vp","vipi", "kwema","mambo", "jambo", "salama", "niaje", "shikamoo", "hujambo",
  "karibu", "asante", "tafadhali", "ndiyo", "hapana", "sijui",
  "nataka", "niambie", "naweza", "ninahitaji", "nitasaidia", "samahani",
  "wekeza", "akiba", "mfuko", "hatifungani", "pensheni", "hisa",
  "soko", "fedha", "faida", "benki", "akaunti", "nunua", "uza",
  "jinsi", "menyu", "endelea", "rudi", "chagua", "anza", "ombi",
  "swali", "jibu", "soma", "jifunze", "kiwango", "moduli", "mada",
  "pamoja", "zaidi", "kidogo", "sawa", "nzuri", "shida", "tatizo",
]);

// English words that clearly indicate English input
const EN_TOKENS = new Set([
  "invest", "investment", "investing", "save", "saving", "savings",
  "fund", "funds", "bond", "bonds", "share", "shares", "pension",
  "account", "money", "return", "risk", "market", "broker", "profit",
  "interest", "dividend", "portfolio", "budget", "income", "expense",
  "buy", "sell", "please", "thank", "thanks", "hello", "hi", "hey",
  "good", "morning", "evening", "afternoon", "help", "what", "how",
  "where", "when", "why", "which", "tell", "show", "want", "need",
  "learn", "question", "answer", "menu", "start", "next", "back",
  "quiz", "level", "module", "lesson", "beginner", "advanced",
]);

// Swahili prefix patterns (verb stems, noun classes)
const SW_PREFIX = /^(ni|na|ku|wa|ya|za|la|ma|vi|mi|si|ki|u|ha)[a-z]{3,}$/;

function keywordScan(text: string): { lang: Lang; confident: boolean } | null {
  const tokens = text.toLowerCase().split(/[\s,.\-!?:;]+/).filter(Boolean);
  let sw = 0;
  let en = 0;

  for (const tok of tokens) {
    if (SW_TOKENS.has(tok)) sw += 3;
    else if (SW_PREFIX.test(tok)) sw += 1;
    if (EN_TOKENS.has(tok)) en += 3;
  }

  if (sw > en && sw >= 3) return { lang: "sw", confident: true };
  if (en > sw && en >= 3) return { lang: "en", confident: true };
  return null;
}

// ─── Claude Haiku fallback ────────────────────────────────────────────────────

const DETECT_SYSTEM =
  `Detect the dominant language of the message. Reply with ONLY one word: "sw" for Kiswahili or "en" for English. No other output.`;

async function claudeDetect(text: string): Promise<{ lang: Lang; confident: boolean }> {
  if (!haiku) return { lang: "en", confident: false };
  try {
    const res = await haiku.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 5,
      system: DETECT_SYSTEM,
      messages: [{ role: "user", content: text.slice(0, 300) }],
    });
    // deno-lint-ignore no-explicit-any
    const raw: string = (res.content[0] as any).text?.trim().toLowerCase() ?? "en";
    const lang: Lang = raw.startsWith("sw") ? "sw" : "en";
    log("LANG_DETECT", { method: "claude-haiku", lang, input: text.slice(0, 60) });
    return { lang, confident: true };
  } catch (err) {
    log("ERROR", { step: "detectLang/haiku", error: String(err) });
    return { lang: "en", confident: false };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LangDetectResult {
  lang: Lang;
  confident: boolean; // false → caller should show the manual language picker
}

export async function detectLang(text: string): Promise<LangDetectResult> {
  // Fast path
  const fast = keywordScan(text);
  if (fast) {
    log("LANG_DETECT", { method: "keyword", lang: fast.lang, input: text.slice(0, 60) });
    return fast;
  }

  // Messages that are too short or purely numeric cannot be detected reliably
  const meaningful = text.replace(/[\d\s\W]/g, "");
  if (meaningful.length < 3) {
    log("LANG_DETECT", { method: "too_short", input: text });
    return { lang: "en", confident: false };
  }

  // Slow path — Claude Haiku
  return await claudeDetect(text);
}
