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

// Wraps client.messages.create with per-call latency + LLM_CALL / LLM_REPLY /
// LLM_ERROR logs. `tool` labels the pipeline step (classify, generalQA, ...)
// so the same underlying model call is distinguishable in the log stream.
// deno-lint-ignore no-explicit-any
async function callClaude(tool: string, req: any): Promise<any> {
  const inputChars = (req.messages ?? []).reduce(
    // deno-lint-ignore no-explicit-any
    (n: number, m: any) => n + (typeof m.content === "string" ? m.content.length : 0),
    0,
  );
  const historyTurns = Math.max(0, (req.messages?.length ?? 1) - 1);
  log("LLM_CALL", {
    provider: "Claude",
    model: req.model,
    tool,
    chars: inputChars,
    historyTurns,
    maxTokens: req.max_tokens,
  });
  const started = performance.now();
  try {
    const res = await client.messages.create(req);
    const ms = Math.round(performance.now() - started);
    // deno-lint-ignore no-explicit-any
    const textBlock = (res.content as any[]).find((b) => b.type === "text");
    const outText: string = textBlock?.text ?? "";
    log("LLM_REPLY", {
      provider: "Claude",
      model: req.model,
      tool,
      ms,
      chars: outText.length,
      inputTokens: res.usage?.input_tokens,
      outputTokens: res.usage?.output_tokens,
      stopReason: res.stop_reason,
      preview: outText.slice(0, 200),
    });
    return res;
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    log("LLM_ERROR", {
      provider: "Claude",
      model: req.model,
      tool,
      ms,
      error: String(err),
    });
    throw err;
  }
}

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
    const res = await callClaude("classify", {
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
UTT AMIS (Unit Trust of Tanzania — Asset Management & Investor Services) is a
government-owned scheme manager licensed by CMSA (uttamis.co.tz). Grounded in
CFE03 §5-§8 (Investment Products, Returns, and Risk).

FUND CATALOGUE (CFE03 §5):
- Umoja Fund (est. 2005) — balanced ~60% equities + 40% government bonds. Growth focus. Minimum TZS 10,000. Ideal 3-5 year goals.
- Liquid Fund — 100% money-market (T-bills, bank deposits). Minimum TZS 100,000, top-ups TZS 10,000. Emergency-fund / 6-12 month goals. Highest liquidity.
- Bond Fund — 100% government + corporate bonds. Steady income. Minimum TZS 50,000. 2+ year goals.
- Watoto Fund — parents saving for children's education. Mixed equities + bonds. Minimum TZS 20,000. 5+ year horizon.
- Jikimu Fund — income-oriented, pays regular monthly distributions. Minimum TZS 500,000. Suited to retirees.
- Wekeza Maisha — 10-year fixed term, mixed portfolio, includes life insurance cover. Minimum TZS 1,000,000. Early-withdrawal penalty applies.
- Children's Career Plan — structured monthly contribution for tertiary education. From ~TZS 25,000/month.

HOW RETURNS WORK (CFE03 §6):
- Two return sources: (a) NAV (Net Asset Value) growth of units held, (b) periodic income distributions.
- NAV is published daily at uttamis.co.tz. You buy at "offer" price, redeem at "bid" price — the small spread covers fund transaction costs.
- Historical context: Umoja Fund has averaged roughly 12-15% p.a. over the last 10 years (past performance is not a guarantee — verify current NAV via web search).
- Distributions: annual for Umoja/Watoto/Children's Career Plan, monthly for Jikimu, at maturity for Wekeza Maisha.

HOW TO INVEST (CFE03 §7):
1. Register via USSD *150*82# (all major networks) or the UTT AMIS mobile app.
2. Verify identity with NIDA (National ID) — one-time.
3. Fund with M-Pesa, Tigo Pesa, Airtel Money, Halopesa, or bank transfer (NMB, CRDB, NBC).
4. Receive confirmation SMS with account number and unit balance.
5. Redemptions typically settle T+2 business days into the same mobile-money or bank account.

TAX & LIQUIDITY:
- Bond Fund interest: 10% withholding tax deducted at source.
- Capital gains on unit redemption: currently not taxed for retail investors in Tanzania (verify with TRA).
- All funds allow redemption at any time — Wekeza Maisha carries an early-withdrawal penalty.

RISK RULES (CFE03 §8, CFE04, CFE05):
- Match fund to the goal: emergency fund → Liquid; kids' school → Watoto or Career Plan; long-term wealth → Umoja; retirement income → Jikimu.
- Diversify across at least two fund types.
- NEVER invest borrowed money in unit trusts (CFE04).
- Verify UTT AMIS is CMSA-licensed at cmsa.go.tz/supervised-entities before every deposit (CFE05).
- Only fund via *150*82#, the official app, or a licensed distributor — never via a personal mobile number.
  `.trim(),

  DSE: `
Dar es Salaam Stock Exchange (DSE, dse.co.tz), regulated by CMSA under the
Capital Markets and Securities Act Cap 79 and Securities Act 2015. Grounded in
CFE03 §5-§8 (Equities), CFE04 (Borrowing), and CFE05 (Investor Protection).

MARKET STRUCTURE:
- Two listing tiers: Main Investment Market Segment (MIMS) for large companies, and Enterprise Growth Market (EGM) for smaller/growing firms.
- ~30 listed companies. Verify the current list at dse.co.tz/listed-companies.

LISTED COMPANIES BY SECTOR (~2026):
- Banking & finance: CRDB Bank, NMB Bank, KCB Group, DCB Commercial Bank, NICO Holdings, Mkombozi Commercial Bank, Maendeleo Bank.
- Telecoms: Vodacom Tanzania, Airtel Africa (cross-listed).
- Beverages & consumer: TBL (Tanzania Breweries), TCC (Tanzania Cigarette Company).
- Cement & construction: Twiga Cement, Tanga Cement, Simba Cement.
- Industrials & services: TOL Gases, Precision Air, Swissport, TCCIA Investment.
- Cross-listed from Kenya: EABL (East African Breweries), Kenya Airways, Nation Media Group, Uchumi, Jubilee Holdings.

HOW SHARES MAKE MONEY (CFE03 §5):
- Dividends — cash paid by the company to shareholders. Two types: interim (after H1 results) and final (after annual results).
- Capital gains — sell at a higher price than you bought. Prices can also FALL.
- Corporate actions — rights issue (existing holders buy new shares at a discount), bonus issue (free extra shares), share split (each old share becomes several new ones — total value unchanged).

HOW TO OPEN A CDS ACCOUNT (required to trade):
1. Choose a CMSA-licensed broker. List at cmsa.go.tz/supervised-entities. Examples: CRDB Capital, NMB Capital, Vertex International Securities, Orbit Securities, Solomon Stockbrokers, Zan Securities.
2. Submit KYC documents: NIDA, phone, physical address, bank account, next-of-kin.
3. Receive your CDS account number — the account itself is free (no maintenance fee).
4. Alternative: install the DSE Hisa Kiganjani mobile app — opens a CDS account and trades directly, no broker visit required.

TRADING FEES (per transaction — apply on BOTH buy and sell):
- Broker commission: ~0.7% (negotiable on large orders)
- DSE fee: ~0.16%
- CMSA fee: ~0.10%
- CDS fee: ~0.10%
- VAT: 18% of the fee amount
- Total round-trip cost: ~2.4% buy + ~2.4% sell = ~4.8% of position size.
- Minimum lot: 100 shares per order.
- Verify current fee schedule at dse.co.tz — DSE occasionally revises.

TRADING MECHANICS:
- Trading days: Monday-Friday, 10:00-15:00 EAT.
- Settlement: T+3 business days (cash and shares change hands 3 days after trade).
- Order types: market order (execute at current best price), limit order (set your maximum buy or minimum sell price).
- Daily price band: DSE halts trading in a stock if its price moves more than ~10% in one session.

DIVIDENDS AND TAX (CFE03 §7):
- Dividend withholding tax: 10% for Tanzanian residents, 15% for non-residents. Deducted at source before the dividend hits your account.
- Ex-dividend date: buy BEFORE this date to receive the upcoming dividend. Buy on/after and the previous holder gets it.
- Dividends are usually paid twice a year (interim + final).

HOW TO EVALUATE A STOCK (CFE03 §6):
- Read the annual report — always available at dse.co.tz/company-releases and on the company's own site.
- EPS (Earnings per share) = net profit ÷ shares outstanding. Higher and rising is better.
- P/E ratio = share price ÷ EPS. Compare against sector peers. Very low P/E can mean cheap OR risky.
- Dividend yield = annual dividend ÷ share price. Yields above 8% are considered high in the Tanzanian market.
- Book value per share = equity ÷ shares outstanding. Price/Book above 1 is normal for growing firms.
- Look at 5-year trends in revenue, profit, and dividends — not just one year.

RISK CATEGORIES (CFE03 §8):
- Market risk — the whole market moves down together (e.g. during a shock).
- Company-specific risk — the individual firm hits trouble (bad results, management issue).
- Liquidity risk — thin trading in small stocks means you may not sell at a fair price quickly.
- Currency risk — cross-listed stocks quoted in KES or USD add FX volatility to TZS returns.

CFE04 (BORROWING) RULES:
- Time horizon for shares: 5+ years minimum. Never for money you need next month.
- Diversify: hold 5-10 different stocks across different sectors.
- NEVER buy shares with borrowed money unless expected returns comfortably exceed the interest cost.
- Do not chase "hot tips" from WhatsApp groups — verify every claim in the annual report.

CFE05 (INVESTOR PROTECTION) — SCAM WARNINGS:
- The ONLY places to buy DSE-listed shares are (a) a CMSA-licensed broker or (b) the DSE Hisa Kiganjani app.
- Anyone offering "unlisted shares", "pre-IPO shares", or "high-return forex/crypto pools" via WhatsApp, Telegram, or a personal mobile number is running a scam.
- Verify every broker at cmsa.go.tz/supervised-entities before paying any money.
- Report suspicious offers to CMSA (+255 22 211 5671) or via cmsa.go.tz.
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

  const res = await callClaude("menuInfo", {
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

  const res = await callClaude("generalQA", {
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

INVESTMENT KNOWLEDGE (CFE03) — UNIT TRUSTS (UTT AMIS):
- UTT AMIS is a CMSA-licensed scheme manager (CMSA Act, Cap 79). Seven public funds: Umoja, Liquid, Bond, Watoto, Jikimu, Wekeza Maisha, Children's Career Plan.
- Umoja is balanced (~60% equity / 40% bonds), minimum TZS 10,000, launched 2005 — the default long-term-growth choice.
- Liquid Fund holds money-market instruments only (T-bills, deposits). Highest liquidity. Suitable for emergency-fund savings (CFE01 §4).
- Bond Fund holds government + corporate bonds. Interest is subject to 10% withholding tax (Income Tax Act).
- Wekeza Maisha is a 10-year contract with life insurance cover — regulated under both CMSA Act and Insurance Act, 2009.
- Returns come from two sources: (a) NAV growth of units held, and (b) periodic distributions. NAV is published daily at uttamis.co.tz.
- Historical Umoja Fund return: roughly 12-15% p.a. over 10 years (UTT AMIS Scheme Prospectuses — past performance not a guarantee).
- Investment channels: USSD *150*82#, UTT AMIS mobile app, or licensed distributor. NIDA required. Fund via mobile money (M-Pesa, Tigo Pesa, Airtel Money, Halopesa) or bank transfer (NMB, CRDB, NBC). Redemption settles T+2.
- Match fund to goal: emergency fund → Liquid; kids' education → Watoto or Career Plan; long-term wealth → Umoja; retirement income → Jikimu (CFE03 §8).

INVESTMENT KNOWLEDGE (CFE03) — SHARES (DSE):
- The Dar es Salaam Stock Exchange (dse.co.tz) is regulated by CMSA under the Capital Markets and Securities Act, Cap 79 and Securities Act, 2015. Trading rules and listed-company obligations sit in the DSE Listing Rules, 2016.
- Two listing tiers: Main Investment Market Segment (MIMS) for large firms, Enterprise Growth Market (EGM) for smaller/growing firms.
- ~30 listed companies. Major names by sector: banking (CRDB, NMB, KCB, DCB); telecoms (Vodacom Tanzania, Airtel Africa); consumer goods (TBL, TCC); cement (Twiga, Tanga, Simba); cross-listed from Kenya (EABL, Kenya Airways, Nation Media, Jubilee Holdings).
- Shares generate returns via (a) dividends (interim + final, taxed 10% for residents / 15% non-residents at source) and (b) capital gains. Corporate actions include rights issues, bonus issues, and share splits.
- To trade, users need a CDS account — opened via a CMSA-licensed broker (CRDB Capital, NMB Capital, Vertex, Orbit, Solomon, Zan) or the DSE Hisa Kiganjani mobile app. The account itself is free.
- Round-trip trading costs: broker ~0.7% + DSE ~0.16% + CMSA ~0.10% + CDS ~0.10%, plus 18% VAT on fees. Round trip ~4.8% of position size. Minimum lot: 100 shares.
- Trading hours: Mon-Fri, 10:00-15:00 EAT. Settlement: T+3. Daily price band: ~10%.
- Evaluate a stock using its annual report (dse.co.tz/company-releases): EPS, P/E ratio, dividend yield, book value, 5-year revenue/profit trends.
- Risk categories: market risk (whole market down), company-specific risk, liquidity risk (thinly-traded shares), currency risk (cross-listed KES/USD stocks).
- Time horizon: 5+ years. Diversify 5-10 stocks across sectors. Never fund share purchases with borrowed money (CFE04).

INVESTMENT SAFETY (CFE05):
- The only channels to buy DSE shares are (a) a CMSA-licensed broker or (b) Hisa Kiganjani.
- "Unlisted shares", "pre-IPO shares", or "high-return investment groups" sold via WhatsApp / Telegram are scams. Verify every scheme at cmsa.go.tz/supervised-entities. Report suspicious offers to CMSA (+255 22 211 5671).

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

  const res = await callClaude("creditKnowledge", {
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
    return "";
  }
}
