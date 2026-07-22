// Gemini fallback LLM for Wekeza Bot.
// Called by llm.ts when Claude is unavailable or throws.
// Uses gemini-2.0-flash with Google Search grounding for live Tanzania data.

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Lang } from "./content.ts";
import { log } from "./logger.ts";

const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
export const geminiEnabled = apiKey.length > 0;
// deno-lint-ignore no-explicit-any
const genai = geminiEnabled ? new GoogleGenerativeAI(apiKey) : (null as any);

// ─── History conversion ───────────────────────────────────────────────────────

type GeminiContent = { role: "user" | "model"; parts: [{ text: string }] };

function toGeminiHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): GeminiContent[] {
  return history.map((h) => ({
    role: (h.role === "assistant" ? "model" : "user") as "user" | "model",
    parts: [{ text: h.content }],
  }));
}

// ─── System prompt ────────────────────────────────────────────────────────────

const BASE_SYSTEM = `
You are Wekeza Bot, a financial literacy assistant for Tanzania (CFE curriculum, NCFI 2023).

You cover: savings, investing, UTT AMIS funds, DSE shares, T-bills, Treasury bonds, pension (NSSF/PSSSF/NISS), credit basics, and scam protection.

Key facts:
- UTT AMIS (uttamis.co.tz): government-owned, CMSA-regulated. Umoja Fund min TZS 10,000; Liquid Fund min TZS 100,000; Wekeza Maisha min TZS 1,000,000 (10-year, life insurance). Dial *150*82# or use the app.
- DSE: ~28 listed companies (CRDB, NMB, TBL, Vodacom, KCB). CDS account via broker or Hisa Kiganjani app. Trading fees ~2.38%.
- T-bills: min TZS 500,000, 35–364 days. Treasury bonds: min TZS 1,000,000, 2–25 years. Both via BoT (bot.go.tz) or banks.
- NSSF (nssf.go.tz): private sector. PSSSF: public sector. NISS: informal sector, min ~TZS 1,000/day via mobile money.
- CMSA (cmsa.go.tz): verify any broker or fund before paying. Scam red flags: guaranteed high returns, recruit others, no CMSA licence, payment to personal mobile.
- Emergency fund: 3–6 months expenses BEFORE investing (CFE03).
- Credit rule (CFE04): monthly repayment must not exceed 30% of net income; never invest borrowed money unless return safely exceeds interest cost.

Authorities: BoT (bot.go.tz), CMSA (cmsa.go.tz), DSE (dse.co.tz), UTT AMIS (uttamis.co.tz), NSSF (nssf.go.tz), CIB Tanzania (cib.co.tz).

Rules:
- Use Google Search for current Tanzania figures (rates, NAV, share prices, auction rates) from the last 3 months. State clearly when a number is from a search.
- No emojis.
- Keep responses under 900 characters.
- No personal investment advice — facts and education only.
- For consultation requests, cite the relevant document (e.g. CFE04, BFIA Cap 342, CMSA Act).
- If off-topic, politely decline and list what you cover.
`.trim();

// ─── Language detection ───────────────────────────────────────────────────────

export async function probeLangGemini(message: string): Promise<Lang | null> {
  if (!genai) return null;
  try {
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(
      `Detect the language of this message. Return ONLY valid JSON: {"lang":"en"} or {"lang":"sw"}\n\nMessage: ${message}`,
    );
    const parsed = JSON.parse(result.response.text().trim()) as { lang: string };
    const lang = parsed.lang;
    return lang === "en" || lang === "sw" ? lang : null;
  } catch {
    return null;
  }
}

// ─── Main QA ──────────────────────────────────────────────────────────────────

export async function askGemini(
  message: string,
  lang: Lang = "en",
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<string> {
  if (!genai) return "";

  const fallback = lang === "sw"
    ? "Samahani, kuna tatizo la kiufundi. Jaribu tena baadaye."
    : "Sorry, there was a technical issue. Please try again later.";

  const langRule = lang === "sw"
    ? "Jibu kwa Kiswahili rahisi na mafupi. Eleza kila neno la kifedha unapoitumia."
    : "Respond in simple, everyday English. Short sentences. Explain every financial term.";

  const modelName = "gemini-2.5-flash";
  const inputChars = message.length + history.reduce((n, h) => n + h.content.length, 0);
  log("LLM_CALL", {
    provider: "Gemini",
    model: modelName,
    tool: "askGemini",
    chars: inputChars,
    historyTurns: history.length,
  });
  const started = performance.now();
  try {
    const model = genai.getGenerativeModel({
      model: modelName,
      systemInstruction: `${BASE_SYSTEM}\n\nLanguage rule: ${langRule}`,
      // deno-lint-ignore no-explicit-any
      tools: [{ googleSearch: {} } as any],
    });

    const result = await model.generateContent({
      contents: [
        ...toGeminiHistory(history),
        { role: "user", parts: [{ text: message }] },
      ],
    });

    const text = result.response.text()
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
      .replace(/[\u{2600}-\u{27BF}]/gu, "")
      .replace(/️/gu, "")
      .replace(/\*+/g, "")
      .replace(/#+/g, "")
      .trim();

    const ms = Math.round(performance.now() - started);
    const usage = result.response.usageMetadata;
    log("LLM_REPLY", {
      provider: "Gemini",
      model: modelName,
      tool: "askGemini",
      ms,
      chars: text.length,
      inputTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
      preview: text.slice(0, 200),
    });
    return text || fallback;
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    log("LLM_ERROR", {
      provider: "Gemini",
      model: modelName,
      tool: "askGemini",
      ms,
      error: String(err),
    });
    return fallback;
  }
}
