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
import * as metrics from "./metrics.ts";
import { type AiAction, recordAiTurn, recordHitl } from "./recorder.ts";

export const claudeEnabled = _claudeEnabled || geminiEnabled;

export async function probeLang(message: string): Promise<Lang | null> {
  if (_claudeEnabled) {
    const detected = await _probeLangClaude(message);
    if (detected) return detected;
  }
  if (geminiEnabled) return probeLangGemini(message);
  return null;
}

// Dashboard flags any row with confidence < 0.62 as a weak answer (gold bar in
// its distribution histogram). We mirror that threshold here to drive the
// action chip: anything we're not sure about gets action='escalated' so
// operators can skim the AI log for borderline turns.
const CONFIDENCE_WEAK_THRESHOLD = 0.62;

// Phrases that signal the model knows it can't answer — mostly "I don't know"
// / out-of-scope / go-ask-a-human templates in EN and SW. Any match pulls the
// confidence floor way down so the row surfaces as weak on the dashboard.
const UNCERTAIN_PATTERNS: RegExp[] = [
  /i\s*don'?t\s*know/i,
  /i\s*cannot\s*(help|answer|assist)/i,
  /i\s*am\s*not\s*(sure|able)/i,
  /out\s*of\s*scope/i,
  /please\s*(contact|reach\s*out|speak\s*to)/i,
  /only\s*cover(s)?\s*tanzania/i,
  /\bsijui\b/i,
  /sina\s*hakika/i,
  /siwezi\s*kujibu/i,
];

/**
 * Rough confidence estimate from signals we actually have (no provider
 * returns a real score). Order of effect:
 *   • empty / very short output → floor at 0.20
 *   • "I don't know" templates → floor at 0.35
 *   • base: Claude 0.85, Gemini 0.75
 *   • fallback penalty: 0.10 off when Gemini only answered because Claude failed
 *   • length boost: tiny bump for detailed answers (cap +0.05)
 *
 * Returns a value in [0.10, 0.99]. Exported for direct unit testing.
 */
export function estimateConfidence(
  provider: "claude" | "gemini",
  output: string,
  opts: { fallback?: boolean } = {},
): number {
  const trimmed = (output ?? "").trim();
  if (trimmed.length < 20) return 0.20;
  if (UNCERTAIN_PATTERNS.some((re) => re.test(trimmed))) return 0.35;
  const base = provider === "claude" ? 0.85 : 0.75;
  const fallbackPenalty = opts.fallback ? 0.10 : 0;
  const lengthBoost = Math.min(0.05, trimmed.length / 5000);
  const score = base - fallbackPenalty + lengthBoost;
  return Math.max(0.10, Math.min(0.99, Number(score.toFixed(3))));
}

function actionFor(confidence: number, output: string): AiAction {
  if (!output || output.trim().length === 0) return "blocked";
  return confidence < CONFIDENCE_WEAK_THRESHOLD ? "escalated" : "auto";
}

export async function askClaude(
  message: string,
  lang: Lang = "en",
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  opts: { userId?: string; intent?: string; handleStart?: number } = {},
): Promise<string> {
  const userId = opts.userId ?? "anon";
  const intent = opts.intent ?? "qa";
  const handleStart = opts.handleStart;
  const handleLatency = () => handleStart == null ? null : performance.now() - handleStart;

  let claudeTried = false;
  if (_claudeEnabled) {
    claudeTried = true;
    const started = performance.now();
    try {
      const answer = await _askClaude(message, lang, history);
      const ms = performance.now() - started;
      if (answer) {
        metrics.llmCall("claude", "ok", ms, lang);
        const confidence = estimateConfidence("claude", answer);
        recordAiTurn({
          userId, lang, intent,
          input: message, output: answer,
          provider: "claude", latencyMs: ms,
          handleLatencyMs: handleLatency(),
          confidence, action: actionFor(confidence, answer),
        });
        return answer;
      }
      metrics.llmCall("claude", "error", ms, lang);
      if (geminiEnabled) metrics.llmFailover("claude", "gemini", "empty_response");
      log("LLM_FALLBACK", {
        tool: "askClaude",
        ms: Math.round(ms),
        error: "Claude returned empty response",
      });
    } catch (err) {
      const ms = performance.now() - started;
      metrics.llmCall("claude", "error", ms, lang);
      if (geminiEnabled) metrics.llmFailover("claude", "gemini", "exception");
      log("LLM_FALLBACK", {
        tool: "askClaude",
        ms: Math.round(ms),
        error: String(err),
      });
    }
  }

  if (geminiEnabled) {
    const started = performance.now();
    const answer = await askGemini(message, lang, history);
    const ms = performance.now() - started;
    const confidence = estimateConfidence("gemini", answer, { fallback: claudeTried });
    recordAiTurn({
      userId, lang, intent,
      input: message, output: answer,
      provider: "gemini", latencyMs: ms,
      handleLatencyMs: handleLatency(),
      confidence, action: actionFor(confidence, answer),
    });
    if (!answer) {
      recordHitl({
        kind: "retry",
        tag: "LLM down",
        title: "Both Claude and Gemini returned empty",
        sub: `lang=${lang} intent=${intent} user=${userId}`,
      });
    }
    return answer;
  }

  // No provider configured at all — nothing to log beyond an HITL retry.
  recordHitl({
    kind: "retry",
    tag: "LLM off",
    title: "No LLM provider configured",
    sub: `lang=${lang} intent=${intent} user=${userId}`,
  });
  return "";
}
