// Thin client for the WhatsApp Cloud API (Meta Graph API).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
import { log } from "./logger.ts";

const GRAPH_VERSION = "v21.0";

export interface ListRow {
  id: string;
  title: string; // max 24 chars
  description?: string; // max 72 chars
}

export interface Button {
  id: string;
  title: string; // max 20 chars
}

export interface OutboundMessage {
  to: string;
  kind: "text" | "buttons" | "list" | "image" | "flow" | "template";
  body: string;
  headerMediaId?: string; // image header on a "buttons" message (card + text + buttons in one)
  mediaId?: string; // for kind "image": an uploaded WhatsApp media id (preferred)
  mediaUrl?: string; // for kind "image": a public https URL (fallback). `body` is the caption
  buttons?: Button[];
  listButton?: string;
  rows?: ListRow[];
  // for kind "flow": launch a published WhatsApp Flow
  flowId?: string;
  flowToken?: string;
  flowCta?: string;
  flowScreen?: string;
  flowData?: Record<string, unknown>;
  // for kind "template": send a pre-approved message template
  templateName?: string;
  templateLang?: string; // language code, e.g. "en" / "sw"
  templateComponents?: unknown[];
}

/** Abstraction so the bot engine can be tested without the network. */
export type Sender = (msg: OutboundMessage) => Promise<void>;

export function createWhatsAppSender(): Sender {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  if (!token || !phoneId) {
    console.warn("WHATSAPP_TOKEN / WHATSAPP_PHONE_ID not set — messages will be dropped");
    return async () => {};
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;

  return async (msg) => {
    const payload = toPayload(msg);
    log("WA_SEND", { to: msg.to, kind: msg.kind });
    const started = performance.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      log("WA_SEND_ERROR", {
        to: msg.to,
        kind: msg.kind,
        network: true,
        error: String(err),
      });
      console.error("WhatsApp send network error", err);
      return;
    }
    const ms = Math.round(performance.now() - started);
    if (!res.ok) {
      const body = await res.text();
      log("WA_SEND_ERROR", { to: msg.to, kind: msg.kind, status: res.status, body: body.slice(0, 500), ms });
      console.error("WhatsApp send failed", res.status, body);
      return;
    }
    log("WA_SEND_OK", { to: msg.to, kind: msg.kind, status: res.status, ms });
  };
}

/**
 * Uploads a local image file to WhatsApp and returns its media id.
 * The id is reusable for sending many times (Meta retains uploaded media ~30
 * days). Works the same locally and on Deploy — no public URL required.
 */
export function createMediaUploader(): (file: string | URL) => Promise<string | null> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  if (!token || !phoneId) {
    console.warn("WHATSAPP_TOKEN / WHATSAPP_PHONE_ID not set — media upload disabled");
    return async () => null;
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/media`;

  return async (file) => {
    const fileName = String(file);
    log("MEDIA_UPLOAD", { file: fileName });
    try {
      const bytes = await Deno.readFile(file);
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", "image/png");
      form.append("file", new Blob([bytes], { type: "image/png" }), "card.png");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.text();
        log("MEDIA_UPLOAD_ERROR", { file: fileName, status: res.status, body: body.slice(0, 500) });
        console.error("media upload failed", res.status, body);
        return null;
      }
      const json = await res.json() as { id?: string };
      log("MEDIA_UPLOAD_OK", { file: fileName, mediaId: json.id ?? null, bytes: bytes.byteLength });
      return json.id ?? null;
    } catch (err) {
      log("MEDIA_UPLOAD_ERROR", { file: fileName, error: String(err) });
      console.error("media upload error", err);
      return null;
    }
  };
}

function toPayload(msg: OutboundMessage): Record<string, unknown> {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: msg.to,
  };

  if (msg.kind === "text") {
    return { ...base, type: "text", text: { body: msg.body } };
  }

  if (msg.kind === "image") {
    const source = msg.mediaId ? { id: msg.mediaId } : { link: msg.mediaUrl };
    return {
      ...base,
      type: "image",
      image: { ...source, ...(msg.body ? { caption: msg.body } : {}) },
    };
  }

  if (msg.kind === "template") {
    return {
      ...base,
      type: "template",
      template: {
        name: msg.templateName,
        language: { code: msg.templateLang ?? "en" },
        ...(msg.templateComponents ? { components: msg.templateComponents } : {}),
      },
    };
  }

  if (msg.kind === "flow") {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "flow",
        body: { text: msg.body },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_token: msg.flowToken,
            flow_id: msg.flowId,
            flow_cta: (msg.flowCta ?? "Start").slice(0, 20),
            flow_action: "navigate",
            flow_action_payload: { screen: msg.flowScreen ?? "LESSON", data: msg.flowData ?? {} },
          },
        },
      },
    };
  }

  if (msg.kind === "buttons") {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        ...(msg.headerMediaId
          ? { header: { type: "image", image: { id: msg.headerMediaId } } }
          : {}),
        body: { text: msg.body },
        action: {
          buttons: (msg.buttons ?? []).slice(0, 3).map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    };
  }

  // list
  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: msg.body },
      action: {
        button: (msg.listButton ?? "Menu").slice(0, 20),
        sections: [{
          title: "Topics",
          rows: (msg.rows ?? []).slice(0, 10).map((r) => ({
            id: r.id,
            title: r.title.slice(0, 24),
            description: r.description?.slice(0, 72),
          })),
        }],
      },
    },
  };
}

/** Extract sender + text (or tapped button/list id) from an inbound webhook payload. */
export interface InboundMessage {
  from: string;
  text: string; // normalised: body text, button id, or list row id
}

// deno-lint-ignore no-explicit-any
export function parseWebhook(body: any): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const m of change?.value?.messages ?? []) {
        if (m.type === "text" && m.text?.body) {
          out.push({ from: m.from, text: String(m.text.body) });
        } else if (m.type === "button") {
          // Template quick-reply button (e.g. the module "Next" button).
          const payload = m.button?.payload ?? m.button?.text;
          if (payload) out.push({ from: m.from, text: String(payload) });
        } else if (m.type === "interactive") {
          const id = m.interactive?.button_reply?.id ??
            m.interactive?.list_reply?.id;
          if (id) out.push({ from: m.from, text: String(id) });
          else if (m.interactive?.nfm_reply) {
            out.push({ from: m.from, text: "flow_complete" }); // Flow finished (nfm_reply)
          }
        }
      }
    }
  }
  log("PARSE_WEBHOOK", { extracted: out.length, kinds: out.map((m) => m.text.slice(0, 24)) });
  return out;
}
