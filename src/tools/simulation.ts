// State 3 — Growth Simulation & Investment Challenges.
//
// Delivers two WhatsApp templates whose CTA button carries a URL variable:
//   1. Simulation program   — a page that shows past growth of major stocks
//   2. DSE Scholar Challenge — the DSE-run live-market investing simulation
//
// Template names and URL variables are left as environment placeholders so
// they can be filled in once WhatsApp Manager approvals land, without any
// further code change:
//
//   SIMULATION_TEMPLATE_NAME     approved template name (with URL button)
//   SIMULATION_URL               URL substituted into the button's {{1}}
//   DSE_CHALLENGE_TEMPLATE_NAME  approved DSE Scholar template name
//   DSE_CHALLENGE_URL            URL substituted into the button's {{1}}
//
// If a template name isn't configured, the deliverer returns false so bot.ts
// can fall back to a "coming soon" text message during local development.

import type { Lang } from "../content.ts";
import type { Sender } from "../whatsapp.ts";
import { sendPlainTemplate } from "../template_sender.ts";
import { log } from "../logger.ts";

const L = (en: string, sw: string): Record<Lang, string> => ({ en, sw });

const T = {
  pickTitle: L(
    "See how investing grows. Pick one:",
    "Ona jinsi uwekezaji unavyokua. Chagua moja:",
  ),
  simBtn: L("Growth simulation", "Simuleshi ya ukuaji"),
  challengeBtn: L("DSE Scholar", "DSE Scholar"),
  back: L("Back to modes", "Rudi kwenye hali"),
  notReadyBody: L(
    "This experience is coming soon. Check back shortly, or explore the education modules meanwhile.",
    "Huduma hii inakuja hivi karibuni. Angalia baadaye, au tumia moduli za elimu kwa sasa.",
  ),
};

// ─── URL-button template helper ─────────────────────────────────────────────
// WhatsApp templates with a URL button need one parameter component that
// substitutes into the button's {{1}} placeholder. This assembles it without
// forcing every caller to know the wire format.
function urlButtonComponents(url: string): unknown[] {
  return [
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: url }],
    },
  ];
}

// ─── Tool: sendSimulationTemplate ───────────────────────────────────────────

export async function sendSimulationTemplate(to: string, lang: Lang): Promise<boolean> {
  const name = Deno.env.get("SIMULATION_TEMPLATE_NAME") ?? "";
  const url = Deno.env.get("SIMULATION_URL") ?? "";
  if (!name) return false;
  try {
    await sendPlainTemplate({
      to,
      templateName: name,
      components: url ? urlButtonComponents(url) : undefined,
    });
    log("SIMULATION_TEMPLATE_SENT", { to, templateName: name, lang, url: Boolean(url) });
    return true;
  } catch (err) {
    log("SIMULATION_SEND_ERROR", { to, templateName: name, lang, error: String(err) });
    return false;
  }
}

// ─── Tool: sendChallengeTemplate ────────────────────────────────────────────

export async function sendChallengeTemplate(to: string, lang: Lang): Promise<boolean> {
  const name = Deno.env.get("DSE_CHALLENGE_TEMPLATE_NAME") ?? "";
  const url = Deno.env.get("DSE_CHALLENGE_URL") ?? "";
  if (!name) return false;
  try {
    await sendPlainTemplate({
      to,
      templateName: name,
      components: url ? urlButtonComponents(url) : undefined,
    });
    log("CHALLENGE_TEMPLATE_SENT", { to, templateName: name, lang, url: Boolean(url) });
    return true;
  } catch (err) {
    log("SIMULATION_SEND_ERROR", { to, templateName: name, lang, error: String(err) });
    return false;
  }
}

// ─── Tool: sendSimulationPicker ─────────────────────────────────────────────

export async function sendSimulationPicker(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({
    to,
    kind: "buttons",
    body: T.pickTitle[lang],
    buttons: [
      { id: "sim_growth", title: T.simBtn[lang] },
      { id: "sim_challenge", title: T.challengeBtn[lang] },
      { id: "go_modes", title: T.back[lang] },
    ],
  });
}

export async function sendNotReadyFallback(to: string, lang: Lang, send: Sender): Promise<void> {
  await send({ to, kind: "text", body: T.notReadyBody[lang] });
}
