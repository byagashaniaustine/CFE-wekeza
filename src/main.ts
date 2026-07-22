// Wekeza Bot — WhatsApp financial-education chatbot (Deno + Hono).
// Webhook endpoints for the WhatsApp Cloud API.
import { Hono } from "hono";
import { createBot } from "./bot.ts";
import { findModule } from "./curriculum.ts";
import type { Lang } from "./content.ts";
import { createKvStore } from "./session.ts";
import { createFlowEndpoint } from "./flow.ts";
import { createMediaUploader, createWhatsAppSender, parseWebhook } from "./whatsapp.ts";
import { sendFlowTemplate, sendPlainTemplate } from "./template_sender.ts";
import { snapshot as metricsSnapshot } from "./metrics.ts";
import { flushLogs, log } from "./logger.ts";

const app = new Hono();
const store = await createKvStore();

// Per-user message queue: chains each incoming handle() call onto the previous
// one for that user, so concurrent webhook POSTs never race on the same session.
// Returns the promise for THIS task so the webhook can await it before
// responding — on Deno Deploy the isolate can be torn down as soon as the
// handler returns, and un-awaited work (bot.handle + its log shipments) is
// dropped silently.
const userQueues = new Map<string, Promise<void>>();
function enqueue(userId: string, task: () => Promise<void>): Promise<void> {
  const prev = userQueues.get(userId) ?? Promise.resolve();
  log("QUEUE_ENQUEUE", { userId, depth: userQueues.size });
  const next = prev.then(task).catch((err) => {
    log("ERROR", { step: "queue/handle", userId, error: String(err) });
    console.error("handle error", err);
  });
  userQueues.set(userId, next);
  next.finally(() => {
    if (userQueues.get(userId) === next) userQueues.delete(userId);
    log("QUEUE_DONE", { userId, depth: userQueues.size });
  });
  return next;
}

// Upload each topic card to WhatsApp on first use and cache the returned media
// id, so a lesson can open with its illustrated card. Works the same locally
// and on Deploy — no public URL required. Cards live in ../assets/cards.
const uploadMedia = createMediaUploader();
const cardsDir = new URL("../assets/cards/", import.meta.url);
const cardIdCache = new Map<string, string>();
const cardPending = new Map<string, Promise<string | null>>();
async function cardMediaId(lessonId: string, lang: Lang): Promise<string | null> {
  const key = `${lessonId}-${lang}`;
  const cached = cardIdCache.get(key);
  if (cached) return cached;
  // Deduplicate concurrent uploads for the same card.
  const inflight = cardPending.get(key);
  if (inflight) return inflight;
  const promise = uploadMedia(new URL(`${key}.png`, cardsDir)).then((id) => {
    if (id) cardIdCache.set(key, id);
    cardPending.delete(key);
    return id;
  });
  cardPending.set(key, promise);
  return promise;
}

const send = createWhatsAppSender();

// Per-module WhatsApp Flows (optional). Each ready module has its own static Flow
// in assets/flows/<moduleId>-<lang>.flow.json. After publishing them in Meta, map
// "<moduleId>-<lang>" → published Flow id in FLOW_IDS (JSON). Any module without a
// mapped id falls back to message screens. FLOW_PRIVATE_KEY enables the optional
// dynamic /flow endpoint (the single-Flow design — not needed for static Flows).
const FLOW_IDS: Record<string, string> = JSON.parse(Deno.env.get("FLOW_IDS") ?? "{}");
const FLOW_PRIVATE_KEY = Deno.env.get("FLOW_PRIVATE_KEY");
const flowHandler = FLOW_PRIVATE_KEY ? createFlowEndpoint(FLOW_PRIVATE_KEY) : null;

const launchFlow = async (to: string, moduleId: string, lang: Lang): Promise<boolean> => {
  const flowId = FLOW_IDS[`${moduleId}-${lang}`];
  if (!flowId) return false;
  const m = findModule(moduleId);
  await send({
    to,
    kind: "flow",
    body: m ? m.title[lang] : "CFE.Wekeza",
    flowId,
    flowToken: `${moduleId}:${lang}`,
    flowCta: lang === "sw" ? "Anza" : "Start",
    flowScreen: "SCREEN_A",
    flowData: {},
  });
  return true;
};

// Approved WhatsApp template names per module (and academy), from WhatsApp Manager.
// NOTE: in WhatsApp Manager every one of these is registered under language "en" —
// the `_sw` names simply hold Swahili content. So we always send with language "en"
// and pick the right name by the user's content language. Override names via the
// MODULE_TEMPLATES / ACADEMY_TEMPLATES env vars if they change.
const DEFAULT_MODULE_TEMPLATES: Record<string, string> = {
  // 🟢 Beginner (English names are inconsistent — mapped by the module number in each
  // template's description: cfe_modules = Module 1, then in order).
  "basic-concepts-en": "cfe_modules",
  "basic-concepts-sw": "basic_module1_sw",
  "why-invest-en": "basic_module_2nd",
  "why-invest-sw": "basic_module2_sw",
  "fundamentals-en": "basics_module2",
  "fundamentals-sw": "basic_module3_sw",
  "ecosystem-en": "basic_module3",
  "ecosystem-sw": "basic_module4_sw",
  // 🟡 Intermediate
  "planning-en": "intermediate_module1",
  "planning-sw": "intermediate_module1_sw",
  "portfolio-building-en": "intermediate_module2",
  "portfolio-building-sw": "intermediate_module2_sw",
  "performance-en": "intermediate_module3",
  "performance-sw": "intermediate_module3_sw",
  "decision-making-en": "intermediate_module4",
  "decision-making-sw": "intermediate_module4_sw",
  // 🔴 Advanced
  "adv-portfolio-en": "advanced_module1",
  "adv-portfolio-sw": "advanced_module1_sw",
  "investor-protection-en": "advanced_module2",
  "investor-protection-sw": "advanced_module2_sw",
  "adv-strategies-en": "advanced_module3",
  "adv-strategies-sw": "advanced_module3_sw",
};
const MODULE_TEMPLATES: Record<string, string> = {
  ...DEFAULT_MODULE_TEMPLATES,
  ...JSON.parse(Deno.env.get("MODULE_TEMPLATES") ?? "{}"),
};

// Product Library academy templates — keyed by "${academyId}-${lang}" matching
// the module template pattern. Falls back to the bare "${academyId}" key when no
// language-specific entry exists. Override names via ACADEMY_TEMPLATES env var.
const DEFAULT_ACADEMY_TEMPLATES: Record<string, string> = {
  // Both languages use the same approved template (English language code in Meta).
  // The Flow receives the user's language via flow_action_data.lang.
  "utt-en": "product_library1",   "utt-sw": "product_library1",
  "dse-en": "product_library2",   "dse-sw": "product_library2",
  "govsec-en": "product_library3", "govsec-sw": "product_library3",
  "pension-en": "product_library4", "pension-sw": "product_library4",
};
const ACADEMY_TEMPLATES: Record<string, string> = {
  ...DEFAULT_ACADEMY_TEMPLATES,
  ...JSON.parse(Deno.env.get("ACADEMY_TEMPLATES") ?? "{}"),
};

// All four academy templates have a Flow button at index 0 — Meta returns 131009
// if flow_token is omitted. Override via FLOW_ACADEMY_IDS env var (JSON array).
const DEFAULT_FLOW_ACADEMY_IDS = ["utt", "dse", "govsec", "pension"];
const FLOW_ACADEMY_IDS = new Set<string>([
  ...DEFAULT_FLOW_ACADEMY_IDS,
  ...JSON.parse(Deno.env.get("FLOW_ACADEMY_IDS") ?? "[]"),
]);

// Send the module/academy template using template_sender.ts (Tool 3).
// All module and academy templates have a Flow button at index 0 → sendFlowTemplate.
const sendModuleEntry = async (to: string, moduleId: string, lang: Lang): Promise<boolean> => {
  const name = MODULE_TEMPLATES[`${moduleId}-${lang}`];
  if (!name) return false; // not mapped → bot falls back to Flow/message screens
  await sendFlowTemplate({
    to,
    templateName: name,
    lang,
    flowToken: `${moduleId}:${lang}`,
    screen: "SCREEN_A",
    flowActionData: { moduleId, lang },
  });
  return true;
};

const sendAcademyEntry = async (to: string, academyId: string, lang: Lang): Promise<boolean> => {
  const name = ACADEMY_TEMPLATES[`${academyId}-${lang}`] ?? ACADEMY_TEMPLATES[academyId];
  if (!name) return false;
  if (FLOW_ACADEMY_IDS.has(academyId)) {
    await sendFlowTemplate({
      to,
      templateName: name,
      lang,
      flowToken: `${academyId}:${lang}`,
      screen: "SCREEN_A",
    });
  } else {
    await sendPlainTemplate({ to, templateName: name, lang });
  }
  return true;
};

const bot = createBot(store, send, { cardMediaId, launchFlow, sendModuleEntry, sendAcademyEntry });

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "wekeza-bot";

log("BOOT", {
  port: Number(Deno.env.get("PORT") ?? 8000),
  flowEndpointEnabled: Boolean(flowHandler),
  moduleTemplates: Object.keys(MODULE_TEMPLATES).length,
  academyTemplates: Object.keys(ACADEMY_TEMPLATES).length,
  flowIds: Object.keys(FLOW_IDS).length,
  metricsProtected: Boolean(Deno.env.get("METRICS_TOKEN")),
  streamlogia: Boolean(Deno.env.get("STREAMLOGIA_API_KEY") && Deno.env.get("STREAMLOGIA_PROJECT_ID")),
});
// Ship the boot event before opening the server, so it lands even on cold-start
// isolates that may terminate the moment the first request handler completes.
await flushLogs();

app.get("/", (c) => c.text("Wekeza Bot is running 🪙"));

// Metrics snapshot. If METRICS_TOKEN is set, callers must send
// `Authorization: Bearer <token>` (or `?token=<token>`); otherwise the endpoint
// is open — set the token in Deploy to keep counters private.
const METRICS_TOKEN = Deno.env.get("METRICS_TOKEN");
app.get("/metrics", (c) => {
  if (METRICS_TOKEN) {
    const auth = c.req.header("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const supplied = bearer || c.req.query("token") || "";
    if (supplied !== METRICS_TOKEN) return c.text("Unauthorized", 401);
  }
  return c.json(metricsSnapshot());
});

// Webhook verification (Meta sends this once when you configure the webhook).
app.get("/webhook", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");
  const ok = mode === "subscribe" && token === VERIFY_TOKEN && !!challenge;
  log("WEBHOOK_GET", { mode, tokenMatch: token === VERIFY_TOKEN, ok });
  if (ok) return c.text(challenge!);
  return c.text("Forbidden", 403);
});

// Inbound messages. We await each enqueued bot.handle() and then flushLogs()
// BEFORE returning — otherwise Deno Deploy tears down the isolate as soon as
// the response is sent and every in-flight log fetch is dropped.
app.post("/webhook", async (c) => {
  const body = await c.req.json().catch(() => null);
  const messages = parseWebhook(body);
  log("WEBHOOK_POST", { messages: messages.length, hasBody: !!body });
  const tasks = messages.map((m) => enqueue(m.from, () => bot.handle(m.from, m.text)));
  await Promise.allSettled(tasks);
  await flushLogs();
  return c.json({ ok: true });
});

// WhatsApp Flows data-exchange endpoint (encrypted). Returns base64 ciphertext.
app.post("/flow", async (c) => {
  if (!flowHandler) {
    log("FLOW_REQ", { configured: false });
    await flushLogs();
    return c.text("flow endpoint not configured", 503);
  }
  const raw = await c.req.text();
  log("FLOW_REQ", { configured: true, bytes: raw.length });
  const { status, body } = await flowHandler(raw);
  log("FLOW_ENCRYPT", { status, bytes: body.length });
  await flushLogs();
  return c.body(body, status as 200, { "content-type": "text/plain" });
});

Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8000) }, app.fetch);
