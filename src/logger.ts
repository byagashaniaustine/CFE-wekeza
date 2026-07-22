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
  | "MEDIA_UPLOAD"    // media upload attempt
  | "MEDIA_UPLOAD_OK" // media upload success (returns id)
  | "MEDIA_UPLOAD_ERROR" // media upload failed
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
  if (category === "MEDIA_UPLOAD_ERROR") return "error";
  return "info";
}

function ship(entry: Record<string, unknown>, category: LogCategory): void {
  if (!client) return;
  const method = levelFor(category);
  const message = String(entry.step ?? entry.msg ?? category);
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
