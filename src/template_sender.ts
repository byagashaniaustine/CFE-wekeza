// Tool 3: WhatsApp Flow template sender.
// Sends module and academy templates in the user's identified language,
// including the required flow_token component for templates that have a
// Flow button at index 0.
//
// Design mirrors Kulwa-kopagari/services/meta.py → send_manka_menu_template()
// but is written in TypeScript for Deno and uses fetch() instead of requests.

import { log } from "./logger.ts";
import type { Lang } from "./content.ts";

const ACCESS_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";
const API_VERSION = "v21.0";
const API_URL =
  `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlainTemplateOptions {
  to: string;
  templateName: string;
  lang?: Lang;
  components?: unknown[];
}

export interface FlowTemplateOptions {
  to: string;
  templateName: string;
  lang: Lang;
  // Identifies the session — echoed back by the Flow on submit.
  flowToken: string;
  // First screen the Flow opens on. Default: "SCREEN_A".
  screen?: string;
  // Extra key-value data injected into the Flow's initial screen data.
  flowActionData?: Record<string, unknown>;
}

// ─── Core sender ─────────────────────────────────────────────────────────────

// WhatsApp Manager registers all CFE.Wekeza templates under language code "en"
// regardless of whether their content is Swahili — the _sw suffix in the name
// carries the language, not the code.
const TEMPLATE_LANG_CODE = "en";

async function postTemplate(
  to: string,
  templateName: string,
  components?: unknown[],
): Promise<void> {
  const payload = {
    messaging_product: "whatsapp",
    to: to.replace("+", ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: TEMPLATE_LANG_CODE },
      ...(components?.length ? { components } : {}),
    },
  };

  log("TEMPLATE_SEND", { to, templateName, hasComponents: !!(components?.length) });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    log("TEMPLATE_ERROR", { to, templateName, status: res.status, body });
    throw new Error(`WhatsApp template send failed ${res.status}: ${body}`);
  }

  log("TEMPLATE_SENT", { to, templateName });
}

// ─── Public helpers ───────────────────────────────────────────────────────────

// Send a template that has no interactive variables (e.g. quick-reply buttons
// with static payloads). Safe to call with no components array.
export async function sendPlainTemplate({
  to,
  templateName,
  components,
}: PlainTemplateOptions): Promise<void> {
  await postTemplate(to, templateName, components);
}

// Send a template whose button at index 0 is a WhatsApp Flow button.
// Meta requires the flow_token to be supplied at send time; without it the API
// returns error 131009 "Components sub_type invalid".
//
// Mirrors send_manka_menu_template() in Kulwa-kopagari/services/meta.py.
export async function sendFlowTemplate({
  to,
  templateName,
  lang,
  flowToken,
  screen = "SCREEN_A",
  flowActionData = {},
}: FlowTemplateOptions): Promise<void> {
  const components = [
    {
      type: "button",
      sub_type: "flow",
      index: "0",
      parameters: [
        {
          type: "action",
          action: {
            flow_token: flowToken,
            flow_action_data: {
              screen,
              lang, // pass user's language into the Flow so it can adapt content
              ...flowActionData,
            },
          },
        },
      ],
    },
  ];

  await postTemplate(to, templateName, components);
}

// Convenience wrapper: choose sendFlowTemplate vs sendPlainTemplate based on
// whether a flowToken is provided. Called by sendModuleEntry / sendAcademyEntry
// in main.ts.
export async function sendModuleTemplate({
  to,
  templateName,
  lang,
  moduleId,
  isFlowTemplate = true,
}: {
  to: string;
  templateName: string;
  lang: Lang;
  moduleId: string;
  isFlowTemplate?: boolean;
}): Promise<void> {
  if (isFlowTemplate) {
    await sendFlowTemplate({
      to,
      templateName,
      lang,
      flowToken: `${moduleId}:${lang}`,
      screen: "SCREEN_A",
    });
  } else {
    await sendPlainTemplate({ to, templateName, lang });
  }
}
