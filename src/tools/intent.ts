// Intent classifier — routes fuzzy free text to one of the bot's states.
//
// Runs AFTER all explicit routing (buttons, mode ids, exact-match invest
// triggers, greetings, nav words) has failed. Uses Claude Haiku with a
// bilingual system prompt so both English and Swahili phrasings map to the
// same buckets. Falls back to `unknown` when the LLM is unavailable or
// unsure, and the bot then treats the message as a general tutor question.
//
// Buckets:
//   onboard    → user wants to start investing / sign up / open an account
//   simulation → user seeks assurance about safety, losses, past growth,
//                or wants to see the market/DSE Scholar challenge
//   ask        → user has a specific factual question about investing
//   unknown    → nothing above fits (defer to the tutor)

import Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "../content.ts";
import { log } from "../logger.ts";

const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
// deno-lint-ignore no-explicit-any
const haiku: any = apiKey ? new Anthropic({ apiKey }) : null;

export type Intent = "onboard" | "simulation" | "ask" | "unknown";

export interface IntentResult {
  intent: Intent;
  confident: boolean;
}

const CLASSIFY_SYSTEM = `You classify user messages for a Tanzanian investment WhatsApp bot into ONE of four intents.

Return EXACTLY one word: ONBOARD, SIMULATION, ASK, or UNKNOWN. No other output.

ONBOARD — user wants to start investing, sign up, register, or open an account.
  Examples:
    "I want to invest"
    "nataka kuwekeza"
    "how do I start investing?"
    "sign me up"
    "nisaidie kuanza"
    "help me register with UTT"

SIMULATION — user is seeking assurance about safety / losses, wants proof of past
growth, or is curious about live-market challenges before committing money.
  Examples:
    "is my money safe?"
    "will I lose?"
    "najuaje sitopata hasara?"
    "pesa zangu ni salama?"
    "how has DSE performed in the past?"
    "prove that investing works"
    "onyesha ukuaji wa hisa"

ASK — user has a specific factual question about investing concepts, products,
mechanics, or terminology.
  Examples:
    "what is UTT?"
    "how do treasury bonds work?"
    "what is diversification?"
    "P/E ratio ni nini?"
    "explain a unit trust"
    "je hatifungani ni nini?"

UNKNOWN — greetings, thanks, small talk, or genuinely unclear intent.

Rules:
- If the user names a specific platform they want to invest in (UTT / DSE), still classify as ONBOARD.
- If the user asks about safety AND names a specific concept ("is DSE safe?"), prefer SIMULATION over ASK — they want assurance, not a definition.
- If unsure, prefer UNKNOWN so the tutor answers instead of forcing a state.`;

// _lang is accepted for symmetry with other tools; the classifier is language-
// agnostic (Haiku handles EN + SW natively) but keeping the parameter lets
// future keyword fast-paths become language-aware without a signature change.
export async function classifyIntent(text: string, _lang: Lang): Promise<IntentResult> {
  if (!haiku) return { intent: "unknown", confident: false };
  const trimmed = text.slice(0, 500);
  const model = "claude-haiku-4-5-20251001";
  log("LLM_CALL", {
    provider: "Claude",
    model,
    tool: "classifyIntent",
    chars: trimmed.length,
    historyTurns: 0,
  });
  const started = performance.now();
  try {
    const res = await haiku.messages.create({
      model,
      max_tokens: 10,
      system: CLASSIFY_SYSTEM,
      messages: [{ role: "user", content: trimmed }],
    });
    const ms = Math.round(performance.now() - started);
    // deno-lint-ignore no-explicit-any
    const raw: string = ((res.content[0] as any).text ?? "").trim().toUpperCase();
    const intent = parseIntent(raw);
    log("LLM_REPLY", {
      provider: "Claude",
      model,
      tool: "classifyIntent",
      ms,
      chars: raw.length,
      inputTokens: res.usage?.input_tokens,
      outputTokens: res.usage?.output_tokens,
      preview: raw,
    });
    log("INTENT_CLASSIFIED", { intent, input: text.slice(0, 100) });
    return { intent, confident: intent !== "unknown" };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    log("LLM_ERROR", {
      provider: "Claude",
      model,
      tool: "classifyIntent",
      ms,
      error: String(err),
    });
    return { intent: "unknown", confident: false };
  }
}

// Exported for testing — pure string → Intent mapping.
export function parseIntent(raw: string): Intent {
  const s = raw.trim().toUpperCase();
  if (s.startsWith("ONBOARD")) return "onboard";
  if (s.startsWith("SIMULATION")) return "simulation";
  if (s.startsWith("ASK")) return "ask";
  return "unknown";
}
