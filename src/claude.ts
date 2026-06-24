// Multi-tool Claude integration for Wekeza Bot.
//
// Pipeline (every free-form message):
//   Message → [Tool 1: classifyIntent] → [Router] → one of:
//     [Tool 2: menuInfoResponse]  — verifies menu topics, returns curriculum facts + live data
//     [Tool 3: generalQA]         — CFE-grounded Q&A, simple language, web search for 3-month data
//     [Tool 4: consultation]      — deep investment analysis, Tanzania authorities, CFE references
//     [inline]                    — greeting / off-topic handled directly in router

import Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "./content.ts";
import { log } from "./logger.ts";

const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
export const claudeEnabled = apiKey.length > 0;
// deno-lint-ignore no-explicit-any
const client = claudeEnabled ? new Anthropic({ apiKey }) : (null as any);

// ─── Types ────────────────────────────────────────────────────────────────────

export type Intent =
  | "GREETING"
  | "MENU_NAVIGATION"
  | "MENU_INFO_QUERY"
  | "GENERAL_QUESTION"
  | "CONSULTATION"
  | "OFF_TOPIC";

export type Topic =
  | "BASICS"
  | "UTT_AMIS"
  | "DSE"
  | "BONDS"
  | "PENSION"
  | "SAFETY";

type Classification = {
  intent: Intent;
  topic: Topic | null;
  lang: Lang;
};

// ─── Tool 1: Intent Classifier ────────────────────────────────────────────────
// Small, fast call that returns structured JSON only.

const CLASSIFIER_PROMPT = `
You are an intent classifier for a Tanzania financial literacy WhatsApp bot.
Analyse the user message and return ONLY a valid JSON object — no other text.

JSON shape:
{
  "intent": string,
  "topic": string or null,
  "lang": string
}

INTENT values:
  GREETING        — user is greeting or just starting (hi, hello, habari, mambo, anza, start)
  MENU_NAVIGATION — user is navigating the structured menu (next, quiz, menu, lesson selection, A/B/C answers)
  MENU_INFO_QUERY — asking about a specific topic covered in the bot menu (e.g. "how does UTT AMIS work?")
  GENERAL_QUESTION — financial literacy question not tied to one specific menu section
  CONSULTATION    — wants analysis or advice on their personal investment situation ("I have TZS X, what should I do?", "I want to invest for 5 years")
  OFF_TOPIC       — nothing to do with personal finance or investing in Tanzania

TOPIC (set only when intent is MENU_INFO_QUERY, otherwise null):
  BASICS    — saving, investing, emergency fund, risk, diversification
  UTT_AMIS  — unit trusts, UTT AMIS funds, Umoja, Liquid, Bond, Watoto, Jikimu, Wekeza Maisha
  DSE       — shares, CDS account, stockbroker, dividends, DSE Hisa Kiganjani
  BONDS     — T-bills, Treasury bonds, Bank of Tanzania auctions
  PENSION   — NSSF, PSSSF, NISS, retirement saving
  SAFETY    — scam prevention, CMSA licensing, red flags

LANG detection from message keywords:
  en — English words present: invest, save, shares, fund, bond, pension, account, money, return, risk, how, what, where, buy, sell, interest, profit, market, broker
  sw — Kiswahili words present: wekeza, akiba, hisa, mfuko, hatifungani, pensheni, akaunti, fedha, faida, hatari, riba, nunua, uza, jinsi, nini, niambie, nataka, naweza, benki

Return ONLY the JSON object.
`.trim();

async function classifyIntent(message: string): Promise<Classification> {
  try {
    const res = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 120,
      system: CLASSIFIER_PROMPT,
      messages: [{ role: "user", content: message }],
    });
    // deno-lint-ignore no-explicit-any
    const raw = (res.content[0] as any).text as string;
    const result = JSON.parse(raw.trim()) as Classification;
    log("CLASSIFY", { intent: result.intent, topic: result.topic, lang: result.lang });
    return result;
  } catch (err) {
    log("ERROR", { step: "classifyIntent", error: String(err) });
    return { intent: "GENERAL_QUESTION", topic: null, lang: "en" };
  }
}

// ─── Tool 2: Menu Info Response ───────────────────────────────────────────────
// Verifies and answers questions about a specific menu topic.
// Uses hardcoded CFE facts + live web search for current figures.

const MENU_FACTS: Record<Topic, string> = {
  BASICS: `
- Build an emergency fund of 3–6 months expenses BEFORE investing (CFE Module CFE03).
- Risk ladder (low to high): T-bills and UTT Liquid Fund → UTT Umoja Fund → DSE individual shares.
- Diversify: spread money across types to reduce risk.
- Match investment duration to goal: under 1 year → Liquid Fund/T-bills; 1–5 years → bonds; 5+ years → shares or pension.
  `.trim(),

  UTT_AMIS: `
- UTT AMIS (uttamis.co.tz) is government-owned and CMSA-regulated.
- Umoja Fund: minimum ~TZS 10,000, balanced equity+bond growth since 2005.
- Liquid Fund: minimum TZS 100,000, top-ups TZS 10,000, money-market, high liquidity.
- Bond Fund: income from government and corporate bonds.
- Watoto Fund: long-term saving for children's education.
- Jikimu Fund: designed to pay regular monthly income.
- Wekeza Maisha: minimum TZS 1,000,000, 10-year term, includes life insurance cover.
- How to invest: dial *150*82# or use the UTT AMIS app. Register with NIDA ID.
- Payment: M-Pesa, Tigo Pesa, Airtel Money, Halopesa, or bank transfer.
  `.trim(),

  DSE: `
- Dar es Salaam Stock Exchange (~28 listed companies): CRDB, NMB, TBL, Vodacom, KCB, and others.
- Earnings come from dividends and share price growth. Prices can also fall.
- Need a free CDS account — open via a licensed broker or the DSE Hisa Kiganjani app.
- Maximum trading fees: ~2.38% per transaction (broker + DSE + CMSA + CDS combined).
- Get the licensed broker list at dse.co.tz or cmsa.go.tz.
- Investment horizon: think 5+ years. Read company annual reports before buying.
  `.trim(),

  BONDS: `
- T-bills: minimum TZS 500,000, terms 35/91/182/364 days, sold at a discount to face value.
- Treasury bonds: minimum TZS 1,000,000, 2–25 year maturities, fixed coupon paid every 6 months.
- Both are government-backed — among the safest instruments in Tanzania.
- Open a CDS account at the Bank of Tanzania (bot.go.tz) directly or through NMB/CRDB/other banks.
- Check the BoT auction calendar and submit a competitive bid before the auction date.
- Long-maturity bond interest has favourable tax treatment.
  `.trim(),

  PENSION: `
- NSSF: for private-sector employees. Employer and employee both contribute.
- PSSSF: for public-sector employees.
- NISS (National Informal Sector Scheme): for self-employed, traders, farmers, boda boda riders.
- NISS minimum contribution: ~TZS 1,000 per day, paid via mobile money.
- Benefits include pension, invalidity cover, and survivors' benefits.
- Register at nssf.go.tz or any NSSF office.
- Starting early has far more impact than starting with a large amount.
  `.trim(),

  SAFETY: `
- CMSA (Capital Markets and Securities Authority) licenses all brokers, fund managers, and schemes.
- Always verify any investment at cmsa.go.tz → Supervised Entities before paying.
- Scam red flags: "guaranteed" high returns (e.g. 30% per month); pressure to recruit others;
  unlicensed Telegram/WhatsApp "forex" or "crypto" groups; payment to a personal mobile number;
  no physical office; no CMSA licence.
- If in doubt: do not pay. Report to CMSA (+255 22 211 5671) or the police.
- Legitimate investing grows wealth gradually — there are no shortcuts.
  `.trim(),
};

async function menuInfoResponse(
  message: string,
  topic: Topic,
  lang: Lang,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const langRule = lang === "sw"
    ? "Respond in simple, everyday Kiswahili. Short sentences. Explain any financial term you use."
    : "Respond in simple, everyday English. Short sentences. Explain any financial term you use.";

  const system = `
You are Wekeza Bot, a financial literacy assistant for Tanzania (CFE curriculum, NCFI 2023).
The user is asking about: ${topic}.

Reference facts for this topic:
${MENU_FACTS[topic]}

Rules:
- ${langRule}
- Search the web for any current Tanzania figures (interest rates, NAV, share prices, auction rates) from the last 3 months. State clearly if a number is from a web search.
- No emojis.
- Keep response under 900 characters.
- No personal investment advice — facts and education only.
  `.trim();

  const res = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 500,
    system,
    // deno-lint-ignore no-explicit-any
    tools: [{ type: "web_search_20260209", name: "web_search" } as any],
    messages: [...history, { role: "user", content: message }],
  });

  return extractText(res);
}

// ─── Tool 3: General Q&A ──────────────────────────────────────────────────────
// Answers financial literacy questions grounded in the full CFE curriculum.
// Uses web search for current data.

async function generalQA(
  message: string,
  lang: Lang,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const langRule = lang === "sw"
    ? "Respond in simple, everyday Kiswahili. Short sentences. Explain every term."
    : "Respond in simple, everyday English. Short sentences. Explain every term.";

  const system = `
You are Wekeza Bot, a financial literacy assistant for Tanzania.
Your knowledge comes from the CFE (Certified Financial Educators) curriculum, Tanzania National Council for Financial Inclusion (2023), modules CFE01–CFE05.

Topics you cover:
- CFE01: Financial goal setting, SMART goals, emergency fund
- CFE02: Budgeting, cash flow, spending and saving balance
- CFE03: Savings and investments — risk/return, diversification, time horizons, UTT AMIS, DSE, bonds
- CFE04: Credit and borrowing — do not invest borrowed money without understanding the risk
- CFE05: Financial protection — CMSA-regulated instruments only, scam identification

Tanzania authorities and resources:
- Bank of Tanzania: bot.go.tz
- CMSA: cmsa.go.tz
- DSE: dse.co.tz
- UTT AMIS: uttamis.co.tz
- NSSF: nssf.go.tz

Rules:
- ${langRule}
- Answer ONLY questions about financial literacy in Tanzania. For anything else, politely decline and list what you cover.
- Search the web for current Tanzania figures (rates, NAV, prices) from the last 3 months. State the source.
- No emojis.
- Under 900 characters.
- No personal investment advice — facts and education only.
  `.trim();

  const res = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 500,
    system,
    // deno-lint-ignore no-explicit-any
    tools: [{ type: "web_search_20260209", name: "web_search" } as any],
    messages: [...history, { role: "user", content: message }],
  });

  return extractText(res);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function extractText(res: any): string {
  // deno-lint-ignore no-explicit-any
  return (res.content as any[])
    .filter((b) => b.type === "text")
    .map((b) => b.text as string)
    .join("\n")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/️/gu, "")
    .replace(/\*+/g, "")
    .replace(/#+/g, "")
    .trim();
}

// ─── Tool 4: Credit Knowledge Tutor ──────────────────────────────────────────
// Answers questions about credit, investment products, and financial regulation
// in Tanzania. Every claim is grounded in one of the authorized reference
// documents listed in the system prompt so users can verify independently.

const CREDIT_KNOWLEDGE_SYSTEM = `
You are CFE.Wekeza's Credit and Investment Knowledge Tutor for Tanzania.
You answer questions about credit, borrowing, savings, and investment products.
Every factual claim must cite at least one of the authorized reference documents below.

AUTHORIZED REFERENCE DOCUMENTS:
1. Banking and Financial Institutions Act (BFIA) Cap 342, 2006 — banks, credit institutions, interest rate disclosure
2. Bank of Tanzania Act, 2006 — central bank mandate, monetary policy, government securities auctions
3. Credit Reference Bureau Regulations (GN 423, 2012) — credit reporting, CIB Tanzania (cib.co.tz), credit scores
4. Capital Markets and Securities Act (CMSA Act) Cap 79 — investment schemes, licensed fund managers and brokers
5. Securities Act, 2015 — DSE listed securities, market conduct, investor protection
6. DSE Listing Rules, 2016 — listed-company obligations, trading rules, CDS accounts
7. National Financial Inclusion Framework (NFIF) 2018–2022 — BoT financial inclusion policy targets
8. NCFI CFE Curriculum, 2023 — CFE01 (Goals) CFE02 (Budget) CFE03 (Invest) CFE04 (Credit) CFE05 (Protect)
9. Insurance Act, 2009 (TIRA) — insurance-linked investment products (e.g. UTT Wekeza Maisha)
10. NSSF Act (Cap 50) — National Social Security Fund, contribution rates, benefit entitlements
11. PSSSF Act, 2018 — Public Service Social Security Fund for government employees
12. UTT AMIS Scheme Prospectuses (uttamis.co.tz) — fund terms, minimum amounts, NAV, withdrawal rules
13. Microfinance Act, 2018 — microfinance institutions, SACCOS, lending limits

REGULATORY AUTHORITIES (always include the relevant one):
- Bank of Tanzania (BoT, bot.go.tz): central bank, T-bills/bonds auctioneer, CRB regulator
- CMSA (cmsa.go.tz): capital markets regulator — verify any broker/fund at cmsa.go.tz/supervised-entities
- DSE (dse.co.tz): stock exchange — listed companies, CDS accounts, trading fees
- UTT AMIS (uttamis.co.tz): government-owned unit trust manager, *150*82#, app, mobile money
- NSSF (nssf.go.tz): pension for private-sector and informal workers (NISS scheme)
- PSSSF: pension for public-sector employees
- TIRA (tira.go.tz): insurance products regulation
- CIB Tanzania (cib.co.tz): Credit Information Bureau — credit reports, clearing credit history

CREDIT KNOWLEDGE (CFE04):
- Never invest borrowed money unless the expected return safely exceeds the interest cost
- CIB Tanzania holds credit history from banks and MFIs; users can request a free credit report once a year
- BFIA requires all lenders to disclose total cost of credit (interest + fees) before signing
- Predatory lending red flags: no written contract, fees deducted upfront, collateral seizure without court order
- Formal credit options: bank loans, SACCO credit, FINCA, NMB/CRDB personal loans, mobile loans (M-Pawa, Timiza)
- Rule of thumb (CFE04): monthly loan repayment should not exceed 30% of net monthly income

RESPONSE FORMAT:
- Cite document by name in parentheses, e.g. (BFIA Cap 342) or (CFE04) or (CMSA Act)
- End with one actionable next step the user can take today
- Include a one-line disclaimer: this is educational content, not licensed financial advice
`.trim();

async function creditKnowledge(
  message: string,
  lang: Lang,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const langRule = lang === "sw"
    ? "Jibu kwa Kiswahili rahisi na mafupi. Eleza kila neno la kifedha unapoitumia. Taja hati husika."
    : "Respond in simple, short English sentences. Explain every financial term. Cite the relevant document.";

  const res = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 700,
    system: `${CREDIT_KNOWLEDGE_SYSTEM}\n\nLanguage rule: ${langRule}`,
    // deno-lint-ignore no-explicit-any
    tools: [{ type: "web_search_20260209", name: "web_search" } as any],
    messages: [...history, { role: "user", content: message }],
  });

  return extractText(res);
}

// ─── Exported lang probe (used by bot.ts Tool 1/2 integration) ───────────────
// Lightweight call that runs only classifyIntent and returns the detected language.
// bot.ts calls this when s.lang is null so it can skip the manual picker.
export async function probeLang(message: string): Promise<Lang | null> {
  if (!client) return null;
  try {
    const c = await classifyIntent(message);
    return c.lang ?? null;
  } catch {
    return null;
  }
}

// ─── Main Dispatcher (called from bot.ts fallback) ────────────────────────────

export async function askClaude(
  message: string,
  lang: Lang = "en",
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<string> {
  if (!client) return "";

  const fallback = lang === "sw"
    ? "Samahani, kuna tatizo la kiufundi. Jaribu tena baadaye."
    : "Sorry, there was a technical issue. Please try again later.";

  try {
    // Step 1 — classify intent
    const c = await classifyIntent(message);
    const replyLang: Lang = c.lang ?? lang;

    // Step 2 — route to the right tool
    switch (c.intent) {
      case "GREETING": {
        log("ROUTE", { tool: "inline/greeting", lang: replyLang });
        const reply = replyLang === "sw"
          ? "Karibu. Andika menyu kuona mada zote."
          : "Welcome. Type menu to see all topics.";
        log("REPLY", { tool: "inline/greeting", chars: reply.length, preview: reply });
        return reply;
      }

      case "MENU_NAVIGATION":
        // Already handled upstream — return empty so bot.ts uses its own fallback
        log("ROUTE", { tool: "none/menu-navigation-upstream" });
        return "";

      case "MENU_INFO_QUERY": {
        const topic: Topic = c.topic ?? "BASICS";
        log("ROUTE", { tool: "menuInfoResponse", topic, lang: replyLang });
        const reply = (await menuInfoResponse(message, topic, replyLang, history)) || fallback;
        log("REPLY", { tool: "menuInfoResponse", topic, chars: reply.length, preview: reply.slice(0, 120) });
        return reply;
      }

      case "GENERAL_QUESTION": {
        log("ROUTE", { tool: "generalQA", lang: replyLang });
        const reply = (await generalQA(message, replyLang, history)) || fallback;
        log("REPLY", { tool: "generalQA", chars: reply.length, preview: reply.slice(0, 120) });
        return reply;
      }

      case "CONSULTATION": {
        // Route to creditKnowledge (Tool 4) — deeper, document-cited analysis
        log("ROUTE", { tool: "creditKnowledge", lang: replyLang });
        const reply = (await creditKnowledge(message, replyLang, history)) || fallback;
        log("REPLY", { tool: "creditKnowledge", chars: reply.length, preview: reply.slice(0, 120) });
        return reply;
      }

      case "OFF_TOPIC":
      default: {
        log("ROUTE", { tool: "inline/off-topic", lang: replyLang });
        const reply = replyLang === "sw"
          ? "Ninasaidia elimu ya fedha Tanzania pekee: akiba, uwekezaji, UTT AMIS, DSE, hatifungani, pensheni, na kujikinga na ulaghai. Andika menyu kuanza."
          : "I only cover Tanzania financial literacy: savings, investing, UTT AMIS, DSE shares, bonds, pensions, and scam protection. Type menu to get started.";
        log("REPLY", { tool: "inline/off-topic", chars: reply.length, preview: reply });
        return reply;
      }
    }
  } catch (err) {
    log("ERROR", { step: "askClaude", error: String(err) });
    return fallback;
  }
}
