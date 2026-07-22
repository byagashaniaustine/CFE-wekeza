// Structured JSON logger. Each line is one event, easy to grep or pipe to jq.
//
// Every event is also shipped to Streamlogia (POST /v1/ingest, Bearer auth) —
// fire-and-forget, so a slow or failing log backend never blocks a webhook.
// Ingestion is disabled automatically when STREAMLOGIA_API_KEY or
// STREAMLOGIA_PROJECT_ID is unset (local dev keeps working).

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

// ─── streamlogia shipping ───────────────────────────────────────────────────
// Environment is read once at module load. Missing key / project → shipping
// disabled (no-op) so local dev is unaffected.
const SL_API_KEY = Deno.env.get("STREAMLOGIA_API_KEY") ?? "";
const SL_PROJECT_ID = Deno.env.get("STREAMLOGIA_PROJECT_ID") ?? "";
const SL_SOURCE = Deno.env.get("STREAMLOGIA_SOURCE") ?? "cfe-invest-bot";
const SL_ENDPOINT = Deno.env.get("STREAMLOGIA_ENDPOINT") ??
  "https://api.streamlogia.com/v1/ingest";
const SL_ENABLED = Boolean(SL_API_KEY && SL_PROJECT_ID);

function levelFor(category: LogCategory): "DEBUG" | "INFO" | "WARN" | "ERROR" {
  if (category === "ERROR") return "ERROR";
  if (category === "WARN") return "WARN";
  if (category === "TEMPLATE_ERROR") return "ERROR";
  if (category === "WA_SEND_ERROR") return "ERROR";
  if (category === "MEDIA_UPLOAD_ERROR") return "ERROR";
  return "INFO";
}

// Tracks every in-flight shipment so a request handler can flushLogs() before
// returning. On Deno Deploy an isolate may be torn down as soon as the handler
// resolves, orphaning any un-awaited fetches — awaiting `pending` first keeps
// the events from being dropped.
const pending = new Set<Promise<void>>();

function ship(entry: Record<string, unknown>, category: LogCategory): void {
  if (!SL_ENABLED) return;
  const payload = {
    projectId: SL_PROJECT_ID,
    level: levelFor(category),
    message: String(entry.step ?? entry.msg ?? category),
    source: SL_SOURCE,
    timestamp: entry.ts,
    tags: [category],
    meta: entry,
  };
  const p: Promise<void> = fetch(SL_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("streamlogia ship non-2xx", res.status, body.slice(0, 300));
      }
    })
    .catch((err) => {
      console.error("streamlogia ship failed", String(err));
    });
  pending.add(p);
  p.finally(() => pending.delete(p));
}

/**
 * Await every in-flight log shipment. Call this at the end of a request
 * handler (before returning the response) so Deno Deploy doesn't tear down
 * the isolate mid-fetch. No-op when shipping is disabled or the queue is
 * already empty.
 */
export async function flushLogs(): Promise<void> {
  if (pending.size === 0) return;
  await Promise.allSettled([...pending]);
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
