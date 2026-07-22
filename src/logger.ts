// Structured JSON logger. Each event is written to stdout as one JSON line
// (easy to grep / pipe to jq) and shipped to Streamlogia via the official
// @streamlogia/javascript-sdk. Shipping is disabled automatically when
// STREAMLOGIA_API_KEY or STREAMLOGIA_PROJECT_ID is unset.
//
// The SDK is configured with batchSize=1 so every call ships immediately —
// this matches Deno Deploy's serverless execution model, where an isolate
// can be torn down as soon as a request handler resolves. flushLogs() is
// still called at the end of each request handler to await any promises the
// SDK has in flight before the response goes out.
import { LogIngestorClient } from "@streamlogia/javascript-sdk";

export type LogCategory =
  // Ingress / egress
  | "BOOT"            // process startup + resolved config
  | "WEBHOOK_GET"     // Meta webhook verification challenge
  | "WEBHOOK_POST"    // inbound webhook envelope received
  | "PARSE_WEBHOOK"   // parsed inbound message(s) extracted
  | "QUEUE_ENQUEUE"   // per-user handler enqueued
  | "QUEUE_DONE"      // per-user handler finished
  | "INCOMING"        // message received from WhatsApp (inside bot.handle)
  | "CLASSIFY"        // intent classification result
  | "ROUTE"           // which tool was selected
  | "REPLY"           // message sent back to user (bot-level intent)
  | "LANG_DETECT"     // language detection result (Tool 1)
  // WhatsApp Graph API
  | "WA_SEND"         // outbound Meta Graph send attempt
  | "WA_SEND_OK"      // outbound Meta Graph send success
  | "WA_SEND_ERROR"   // outbound Meta Graph send failed (non-2xx / network)
  | "TEMPLATE_SEND"   // template about to be sent (Tool 3)
  | "TEMPLATE_SENT"   // template sent successfully (Tool 3)
  | "TEMPLATE_ERROR"  // template send failed (Tool 3)
  // WhatsApp Flows
  | "FLOW_REQ"        // /flow endpoint hit
  | "FLOW_DECRYPT"    // request decrypted (or failed)
  | "FLOW_PROCESS"    // pure navigator decided the next screen
  | "FLOW_ENCRYPT"    // response encrypted and returned
  // Session
  | "SESSION_GET"     // session loaded from store
  | "SESSION_SET"     // session persisted
  // LLM
  | "GEMINI_REPLY"    // response from Gemini fallback
  // Generic
  | "WARN"            // non-fatal warning (e.g. LLM failover)
  | "ERROR";          // any caught error

// ─── Streamlogia SDK setup ──────────────────────────────────────────────────
const SL_API_KEY = Deno.env.get("STREAMLOGIA_API_KEY") ?? "";
const SL_PROJECT_ID = Deno.env.get("STREAMLOGIA_PROJECT_ID") ?? "";
const SL_SOURCE = Deno.env.get("STREAMLOGIA_SOURCE") ?? "cfe-invest-bot";
// The SDK appends /v1/ingest to baseURL internally, so strip any suffix if the
// env var was set to the full ingest URL (backward-compatible with older docs).
const SL_BASE_URL = (Deno.env.get("STREAMLOGIA_ENDPOINT") ?? "https://api.streamlogia.com")
  .replace(/\/v1\/ingest\/?$/, "");
const SL_ENABLED = Boolean(SL_API_KEY && SL_PROJECT_ID);

const client = SL_ENABLED
  ? new LogIngestorClient({
    apiKey: SL_API_KEY,
    projectId: SL_PROJECT_ID,
    source: SL_SOURCE,
    baseURL: SL_BASE_URL,
    // batchSize=1 → every call ships immediately (default, but explicit).
    batchSize: 1,
    // We already write JSON to stdout ourselves — disable the SDK's built-in
    // console mirroring to avoid double-printing every event.
    console: false,
    onError: (err: unknown) => {
      console.error("[streamlogia]", String(err));
    },
  })
  : null;

function levelFor(category: LogCategory): "debug" | "info" | "warn" | "error" {
  if (category === "ERROR") return "error";
  if (category === "WARN") return "warn";
  if (category === "TEMPLATE_ERROR") return "error";
  if (category === "WA_SEND_ERROR") return "error";
  return "info";
}

// Truncate long strings for the human-facing message. Full value still lives
// in `meta` for machines that want it.
function clip(v: unknown, n = 120): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Human-readable one-line description of an event. The full entry ships in
// meta for filtering / debugging — this only shapes the summary that surfaces
// in the Streamlogia UI.
function describe(category: LogCategory, e: Record<string, unknown>): string {
  const g = (k: string) => (e[k] === undefined || e[k] === null ? "" : String(e[k]));
  const has = (k: string) => e[k] !== undefined && e[k] !== null && e[k] !== "";
  switch (category) {
    // ── boot & webhook ingress ────────────────────────────────────────────
    case "BOOT":
      return `Server booted on port ${g("port") || "?"} — flow endpoint ${
        e.flowEndpointEnabled ? "enabled" : "disabled"
      }, ${g("moduleTemplates")} module templates, ${g("academyTemplates")} academy templates, ${
        g("flowIds")
      } published flows, streamlogia ${e.streamlogia ? "ON" : "OFF"}, metrics ${
        e.metricsProtected ? "protected" : "public"
      }`;
    case "WEBHOOK_GET":
      return e.ok
        ? `Meta verified webhook (mode=${g("mode")}, token matched)`
        : `Meta webhook verification rejected (mode=${g("mode")}, tokenMatch=${g("tokenMatch")})`;
    case "WEBHOOK_POST":
      return `Received webhook POST — ${g("messages")} inbound message${g("messages") === "1" ? "" : "s"} in envelope`;
    case "PARSE_WEBHOOK": {
      const n = g("extracted");
      const kinds = e.kinds ? ` (${clip(JSON.stringify(e.kinds), 80)})` : "";
      return `Parsed ${n} inbound message${n === "1" ? "" : "s"} from envelope${kinds}`;
    }
    // ── per-user handler queue ─────────────────────────────────────────────
    case "QUEUE_ENQUEUE":
      return `Queued handler for ${g("userId")} — queue depth now ${g("depth")}`;
    case "QUEUE_DONE":
      return `Handler finished for ${g("userId")} — queue depth ${g("depth")}`;
    // ── bot router ─────────────────────────────────────────────────────────
    case "INCOMING":
      return `${g("from")} sent: "${clip(g("text"), 200)}"`;
    case "ROUTE": {
      const branch = g("branch");
      const who = g("from");
      switch (branch) {
        case "lang_pick":
          return `${who} chose language: ${g("lang")}`;
        case "learn_levels":
          return `${who} entered the Learn Investment journey (choosing level)`;
        case "products":
          return `${who} entered the Investment Products journey (choosing academy)`;
        case "quiz_start":
          return `${who} started the General Quiz`;
        case "ask_intro":
          return `${who} opened the Ask a Question tutor`;
        case "main_menu":
          return `${who} returned to the main menu`;
        case "flow_complete":
          return `${who} finished a WhatsApp Flow (module=${g("moduleId") || "-"})`;
        case "module_open":
          return `${who} opened module '${g("moduleId")}'`;
        case "quiz_answer":
          return `${who} answered quiz Q${g("questionIdx")} on topic '${g("topic")}' — picked option ${g("picked")} (${e.correct ? "correct" : "wrong"})`;
        case "quiz_complete":
          return `${who} completed the quiz — scored ${g("score")}/${g("outOf")}${e.wrongTopics && (e.wrongTopics as unknown[]).length ? `, weak topics: ${clip(JSON.stringify(e.wrongTopics), 100)}` : ""}`;
        case "llm_tutor":
          return `${who} asked the AI tutor (${g("chars")} chars, from state=${g("state")})`;
        default:
          return `${who} routed to '${branch}'`;
      }
    }
    case "REPLY": {
      const to = g("to");
      const kind = g("kind");
      const tool = has("tool") ? ` [${g("tool")}]` : "";
      const preview = has("preview") ? ` — "${clip(g("preview"), 120)}"` : "";
      return `Bot replied to ${to}${tool} — ${kind}${preview}`;
    }
    // ── WhatsApp Graph delivery ────────────────────────────────────────────
    case "WA_SEND":
      return `Sending ${g("kind")} to ${g("to")} via WhatsApp Graph API…`;
    case "WA_SEND_OK":
      return `Delivered ${g("kind")} to ${g("to")} in ${g("ms")}ms (HTTP ${g("status")})`;
    case "WA_SEND_ERROR":
      return e.network
        ? `Network error sending ${g("kind")} to ${g("to")}: ${g("error")}`
        : `Meta Graph rejected ${g("kind")} for ${g("to")} — HTTP ${g("status")} after ${g("ms")}ms: ${clip(g("body"), 200)}`;
    // ── template sending ───────────────────────────────────────────────────
    case "TEMPLATE_SEND":
      return `Preparing template '${g("templateName")}' for ${g("to")} (components ${e.hasComponents ? "present" : "none"})`;
    case "TEMPLATE_SENT":
      return `Sent template '${g("templateName")}' to ${g("to")}`;
    case "TEMPLATE_ERROR":
      return `Template '${g("templateName")}' failed for ${g("to")} — HTTP ${g("status")}: ${clip(g("body"), 200)}`;
    // ── WhatsApp Flows (encrypted screen navigator) ────────────────────────
    case "FLOW_REQ":
      return e.configured === false
        ? "Rejected /flow POST — endpoint not configured (missing FLOW_PRIVATE_KEY)"
        : `Received /flow POST — ${g("bytes")} bytes of ciphertext`;
    case "FLOW_DECRYPT":
      return e.ok
        ? `Decrypted flow request (action=${g("action")}, screen=${g("screen") || "-"})`
        : `Flow decryption FAILED — ${g("reason") || g("error")}`;
    case "FLOW_PROCESS": {
      const action = g("action");
      const mod = g("moduleId");
      const lang = g("lang");
      if (action === "ping") return "Flow health check (ping) — returning active";
      if (action === "INIT") return `Flow INIT for '${mod}' (${lang}) — ${g("total")} screens total`;
      if (action === "NEXT") return `Flow NEXT in '${mod}' (${lang}) — screen ${g("from")} → ${g("to")} of ${g("total")}`;
      if (action === "BACK") return `Flow BACK in '${mod}' (${lang}) — screen ${g("from")} → ${g("to")}`;
      if (action === "DONE") return `Flow DONE for '${mod}' (${lang}) — user reached end of ${g("total")} screens`;
      return `Flow processed action=${action}`;
    }
    case "FLOW_ENCRYPT":
      return `Encrypted flow response — HTTP ${g("status")}, ${g("bytes")} bytes of ciphertext`;
    // ── session store ──────────────────────────────────────────────────────
    case "SESSION_GET":
      return `Loaded session for ${g("user")} (${e.hit ? "cache HIT" : "cache MISS — new session"}, state=${g("state")}, lang=${g("lang") || "unset"}${has("moduleId") ? `, module=${g("moduleId")}` : ""})`;
    case "SESSION_SET":
      return `Persisted session for ${g("user")} — state=${g("state")}, lang=${g("lang") || "unset"}${has("moduleId") ? `, module=${g("moduleId")}` : ""}, lesson=${g("lessonIdx")}, screen=${g("screenIdx")}, quiz=${g("quizIdx")}`;
    // ── intent classification / language / LLM ─────────────────────────────
    case "CLASSIFY":
      return `Claude classified intent as '${g("intent")}'${has("topic") ? ` (topic=${g("topic")})` : ""} — reply language: ${g("lang")}`;
    case "LANG_DETECT":
      return `Language detected as '${g("lang")}' via ${g("method")} — input: "${clip(g("input"), 80)}"`;
    case "GEMINI_REPLY":
      return `Gemini responded — ${g("chars")} chars: "${clip(g("preview"), 120)}"`;
    // ── warnings & errors ──────────────────────────────────────────────────
    case "WARN":
      return `WARNING at ${g("step") || "unknown"}: ${g("msg") || g("error") || "no detail"}`;
    case "ERROR":
      return `ERROR at ${g("step") || "unknown"}: ${g("error") || g("msg") || "no detail"}`;
  }
}

function ship(entry: Record<string, unknown>, category: LogCategory): void {
  if (!client) return;
  const method = levelFor(category);
  const message = describe(category, entry);
  // The SDK's level methods enqueue synchronously and return immediately;
  // errors surface via the onError callback above.
  client[method](message, { tags: [category], meta: entry });
}

/**
 * Await the SDK's internal shipment queue. Call this at the end of every
 * request handler (before returning) so Deno Deploy doesn't tear down the
 * isolate mid-fetch. No-op when shipping is disabled.
 */
export async function flushLogs(): Promise<void> {
  if (!client) return;
  await client.flush();
}

export function log(
  category: LogCategory,
  data: Record<string, unknown>,
): void {
  const entry = {
    ts: new Date().toISOString(),
    category,
    ...data,
  };
  console.log(JSON.stringify(entry));
  ship(entry, category);
}
