// Structured JSON logger. Each line is one event, easy to grep or pipe to jq.

export type LogCategory =
  | "INCOMING"        // message received from WhatsApp
  | "CLASSIFY"        // intent classification result
  | "ROUTE"           // which tool was selected
  | "REPLY"           // message sent back to user
  | "LANG_DETECT"     // language detection result (Tool 1)
  | "TEMPLATE_SEND"   // template about to be sent (Tool 3)
  | "TEMPLATE_SENT"   // template sent successfully (Tool 3)
  | "TEMPLATE_ERROR"  // template send failed (Tool 3)
  | "GEMINI_REPLY"    // response from Gemini fallback
  | "WARN"            // non-fatal warning (e.g. LLM failover)
  | "ERROR";          // any caught error

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
}
