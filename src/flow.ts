// WhatsApp Flows — encrypted data-exchange endpoint + a generic module navigator.
//
// Meta sends an encrypted POST to our endpoint on each Flow interaction. We:
//   1. RSA-OAEP(SHA-256) decrypt the AES key with our business private key
//   2. AES-GCM decrypt the request body with that key + initial vector
//   3. compute the next screen from the curriculum
//   4. AES-GCM encrypt the response with the same key + FLIPPED iv, base64 it
//
// Setup (one-time, in Meta): generate an RSA key pair, upload the PUBLIC key to
// your WhatsApp Business phone number, keep the PRIVATE key (unencrypted PKCS8)
// in FLOW_PRIVATE_KEY, publish the Flow JSON below, and set its endpoint URL to
// https://<your-app>/flow.  Docs: developers.facebook.com/docs/whatsapp/flows
import { findModule, type Lang } from "./curriculum.ts";

// ─── base64 helpers ─────────────────────────────────────────────────────────────
const b64decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64encode = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  return b64decode(body);
}

export function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    pemToDer(pem),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
}

// ─── request / response crypto ──────────────────────────────────────────────────
export interface FlowRequest {
  encrypted_aes_key: string;
  encrypted_flow_data: string;
  initial_vector: string;
}

interface ExchangeBody {
  version: string;
  action: "INIT" | "BACK" | "data_exchange" | "ping";
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
}

async function decryptRequest(req: FlowRequest, privateKey: CryptoKey) {
  const aesKeyRaw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    b64decode(req.encrypted_aes_key),
  );
  const iv = b64decode(req.initial_vector);
  const aesKey = await crypto.subtle.importKey(
    "raw",
    aesKeyRaw,
    { name: "AES-GCM" },
    false,
    ["decrypt", "encrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    aesKey,
    b64decode(req.encrypted_flow_data),
  );
  const body = JSON.parse(new TextDecoder().decode(plain)) as ExchangeBody;
  return { body, aesKey, iv };
}

async function encryptResponse(response: unknown, aesKey: CryptoKey, iv: Uint8Array): Promise<string> {
  const flippedIv = iv.map((b) => b ^ 0xff);
  const data = new TextEncoder().encode(JSON.stringify(response));
  const out = await crypto.subtle.encrypt({ name: "AES-GCM", iv: flippedIv, tagLength: 128 }, aesKey, data);
  return b64encode(new Uint8Array(out));
}

// ─── navigator: turn a module's screens into Flow screen data ─────────────────────
function screenData(moduleId: string, lang: Lang, idx: number): Record<string, unknown> {
  const m = findModule(moduleId);
  const screens = m ? m.lessons.flatMap((l) => l.screens.map((s) => ({ lesson: l.title[lang], s }))) : [];
  const total = screens.length;
  const clamped = Math.max(0, Math.min(idx, total - 1));
  const cur = screens[clamped];
  const isLast = clamped >= total - 1;
  return {
    heading: cur ? cur.s.title[lang] : "",
    lesson: cur ? cur.lesson : "",
    body: cur ? cur.s.body[lang] : "",
    position: total ? `${clamped + 1} / ${total}` : "",
    total,
    idx: clamped,
    next_idx: clamped + 1, // tapping Next on the last screen → total → DONE
    prev_idx: clamped > 0 ? clamped - 1 : 0,
    can_back: clamped > 0,
    is_last: isLast,
  };
}

/** Pure navigation logic (exported for testing without crypto). */
export function processFlow(body: ExchangeBody): unknown {
  if (body.action === "ping") return { data: { status: "active" } };

  const [moduleId, rawLang] = (body.flow_token ?? "basic-concepts:en").split(":");
  const lang: Lang = rawLang === "sw" ? "sw" : "en";
  const m = findModule(moduleId);
  const total = m ? m.lessons.reduce((n, l) => n + l.screens.length, 0) : 0;

  if (body.action === "INIT") return { screen: "LESSON", data: screenData(moduleId, lang, 0) };

  const cur = Number(body.data?.idx ?? 0);
  if (body.action === "BACK") return { screen: "LESSON", data: screenData(moduleId, lang, cur - 1) };

  // data_exchange = the "Next" / footer action
  const nextIdx = Number(body.data?.next_idx ?? cur + 1);
  if (nextIdx >= total) return { screen: "DONE", data: {} };
  return { screen: "LESSON", data: screenData(moduleId, lang, nextIdx) };
}

/** First-screen data to seed the Flow launch payload (so screen 1 isn't blank). */
export function initialScreenData(moduleId: string, lang: Lang): Record<string, unknown> {
  return screenData(moduleId, lang, 0);
}

/**
 * Build a self-contained STATIC Flow JSON for a single module in one language —
 * every lesson baked into its own screen, linked by `navigate`, ending in a
 * terminal screen. No endpoint required. One published Flow per module+language.
 * (See scripts/gen_flows.ts to regenerate all files from the curriculum.)
 */
export function buildModuleFlow(moduleId: string, lang: Lang): unknown | null {
  const m = findModule(moduleId);
  if (!m || m.lessons.length === 0) return null;
  const sw = lang === "sw";
  // Flow screen ids may contain ONLY letters and underscores (no digits): SCREEN_A, SCREEN_B…
  const sid = (i: number): string => {
    let n = i + 1, s = "";
    while (n > 0) {
      s = String.fromCharCode(65 + (n - 1) % 26) + s;
      n = Math.floor((n - 1) / 26);
    }
    return `SCREEN_${s}`;
  };
  const screens = m.lessons.flatMap((l) => l.screens.map((s) => ({ title: s.title[lang], body: s.body[lang] })));
  const total = screens.length;

  const content = screens.map((s, i) => ({
    id: sid(i),
    title: sw ? "Somo" : "Lesson",
    data: {},
    layout: {
      type: "SingleColumnLayout",
      children: [
        { type: "TextSubheading", text: `${i + 1} / ${total}` },
        { type: "TextHeading", text: s.title },
        { type: "TextBody", text: s.body },
        {
          type: "Footer",
          label: i === total - 1 ? (sw ? "Maliza" : "Finish") : (sw ? "Endelea" : "Next"),
          "on-click-action": {
            name: "navigate",
            next: { type: "screen", name: i === total - 1 ? "DONE" : sid(i + 1) },
            payload: {},
          },
        },
      ],
    },
  }));

  const done = {
    id: "DONE",
    title: sw ? "Hongera" : "Complete",
    terminal: true,
    success: true,
    data: {},
    layout: {
      type: "SingleColumnLayout",
      children: [
        { type: "TextHeading", text: sw ? "Moduli imekamilika" : "Module complete" },
        { type: "TextBody", text: sw ? "Umemaliza moduli hii. Endelea kujifunza." : "You have completed this module. Keep learning." },
        { type: "Footer", label: sw ? "Funga" : "Done", "on-click-action": { name: "complete", payload: {} } },
      ],
    },
  };

  return { version: "7.3", screens: [...content, done] };
}

/**
 * Build the endpoint handler. Returns { status, body } where body is the
 * base64 ciphertext (text/plain) Meta expects.
 */
export function createFlowEndpoint(privatePem: string) {
  const keyPromise = importPrivateKey(privatePem);
  return async (rawBody: string): Promise<{ status: number; body: string }> => {
    let req: FlowRequest;
    try {
      req = JSON.parse(rawBody);
    } catch {
      return { status: 400, body: "bad request" };
    }
    if (!req?.encrypted_aes_key || !req?.encrypted_flow_data || !req?.initial_vector) {
      return { status: 400, body: "bad request" };
    }
    let dec;
    try {
      dec = await decryptRequest(req, await keyPromise);
    } catch (err) {
      console.error("flow decrypt failed", err);
      return { status: 421, body: "decryption failed" }; // 421 → Meta refreshes the public key
    }
    const response = processFlow(dec.body);
    const encrypted = await encryptResponse(response, dec.aesKey, dec.iv);
    return { status: 200, body: encrypted };
  };
}

/**
 * Flow JSON to publish once in Meta Flow Builder. One dynamic LESSON screen
 * (content supplied by the endpoint via data_exchange) and a DONE terminal
 * screen. Tweak component styling in Flow Builder as desired.
 */
export const MODULE_FLOW_JSON = {
  version: "7.1",
  data_api_version: "3.0",
  routing_model: { LESSON: ["LESSON", "DONE"], DONE: [] },
  screens: [
    {
      id: "LESSON",
      title: "Lesson",
      data: {
        heading: { type: "string", __example__: "What is Investing?" },
        lesson: { type: "string", __example__: "What is Investing?" },
        body: { type: "string", __example__: "Investing means putting your money to work so it can grow over time." },
        position: { type: "string", __example__: "1 / 24" },
        total: { type: "number", __example__: 24 },
        idx: { type: "number", __example__: 0 },
        next_idx: { type: "number", __example__: 1 },
        prev_idx: { type: "number", __example__: 0 },
        can_back: { type: "boolean", __example__: false },
        is_last: { type: "boolean", __example__: false },
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          { type: "TextSubheading", text: "${data.position}" },
          { type: "TextHeading", text: "${data.heading}" },
          { type: "TextBody", text: "${data.body}" },
          {
            type: "Footer",
            label: "Next",
            "on-click-action": {
              name: "data_exchange",
              payload: { idx: "${data.idx}", next_idx: "${data.next_idx}" },
            },
          },
        ],
      },
    },
    {
      id: "DONE",
      title: "Complete",
      terminal: true,
      success: true,
      layout: {
        type: "SingleColumnLayout",
        children: [
          { type: "TextHeading", text: "Module complete" },
          { type: "TextBody", text: "Well done. Tap Finish to continue learning." },
          {
            type: "Footer",
            label: "Finish",
            "on-click-action": { name: "complete", payload: {} },
          },
        ],
      },
    },
  ],
};
