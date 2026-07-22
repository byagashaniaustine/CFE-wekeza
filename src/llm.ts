// LLM routing: Claude first, Gemini fallback.
// bot.ts imports from here — not directly from claude.ts or gemini.ts.

import {
  askClaude as _askClaude,
  claudeEnabled as _claudeEnabled,
  probeLang as _probeLangClaude,
} from "./claude.ts";
import { askGemini, geminiEnabled, probeLangGemini } from "./gemini.ts";
import type { Lang } from "./content.ts";
import { log } from "./logger.ts";

export const claudeEnabled = _claudeEnabled || geminiEnabled;

export async function probeLang(message: string): Promise<Lang | null> {
  if (_claudeEnabled) {
    const detected = await _probeLangClaude(message);
    if (detected) return detected;
  }
  if (geminiEnabled) return probeLangGemini(message);
  return null;
}

export async function askClaude(
  message: string,
  lang: Lang = "en",
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<string> {
  if (_claudeEnabled) {
    const started = performance.now();
    try {
      const answer = await _askClaude(message, lang, history);
      if (answer) return answer;
      // Claude returned empty (no valid tool response) — treat as a soft fail
      // so Gemini can take over.
      log("LLM_FALLBACK", {
        tool: "askClaude",
        ms: Math.round(performance.now() - started),
        error: "Claude returned empty response",
      });
    } catch (err) {
      log("LLM_FALLBACK", {
        tool: "askClaude",
        ms: Math.round(performance.now() - started),
        error: String(err),
      });
    }
  }
  if (geminiEnabled) return askGemini(message, lang, history);
  return "";
}
