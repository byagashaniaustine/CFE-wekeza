// State 2 — Onboarding tool surface.
//
// Four tools the bot calls when the user picks "Invest now / Start investing":
//   1. submitLead            — normalize raw Flow payload + optional webhook POST + log
//   2. captureFeedback       — record 👍/👎 (+optional note) after onboarding
//   3. resolveOnboardingUrl  — map the picked scheme (utt/dse/…) to a platform URL
//   4. handleFailure         — send bilingual failure message + retry button
//
// The lead capture in parseWebhook already logs the raw ONBOARDING_LEAD event;
// submitLead layers on typed normalization, optional webhook delivery, and a
// dedicated ONBOARDING_LEAD_SUBMITTED event for downstream analytics.

import type { Lang } from "../content.ts";
import type { Sender } from "../whatsapp.ts";
import { log } from "../logger.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Scheme = "utt" | "dse" | "govsec" | "pension";

export interface Lead {
  user: string; // WhatsApp user id (from)
  scheme: Scheme | null;
  phone: string | null;
  nida: string | null;
  consent: boolean | null;
  // UTT-specific
  reg_type: "new" | "existing" | null;
  reg_category: "individual" | "corporate" | "foreigner" | "groups" | null;
  // DSE-specific
  cds_status: "yes" | "no" | null;
  route: "broker" | "mobile" | null;
  // Coming-soon
  notify: boolean | null;
  // Anything else captured in the raw payload
  raw: Record<string, unknown>;
}

export interface SubmitResult {
  ok: boolean;
  lead: Lead;
  webhookStatus?: number;
  error?: string;
}

// ─── Tool 1: submitLead ─────────────────────────────────────────────────────

const LEAD_WEBHOOK_URL = Deno.env.get("LEAD_WEBHOOK_URL") ?? "";

function coerceScheme(v: unknown): Scheme | null {
  const s = String(v ?? "").toLowerCase();
  return s === "utt" || s === "dse" || s === "govsec" || s === "pension" ? s : null;
}

function coerceStr(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function coerceBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === null || v === undefined) return null;
  const s = String(v).toLowerCase();
  if (["true", "yes", "1", "on"].includes(s)) return true;
  if (["false", "no", "0", "off"].includes(s)) return false;
  return null;
}

export function normalizeLead(user: string, raw: Record<string, unknown>): Lead {
  return {
    user,
    scheme: coerceScheme(raw.scheme),
    phone: coerceStr(raw.phone),
    nida: coerceStr(raw.nida),
    consent: coerceBool(raw.consent),
    reg_type: (["new", "existing"] as const).find((s) => s === raw.reg_type) ?? null,
    reg_category: (["individual", "corporate", "foreigner", "groups"] as const).find(
      (s) => s === raw.reg_category,
    ) ?? null,
    cds_status: (["yes", "no"] as const).find((s) => s === raw.cds_status) ?? null,
    route: (["broker", "mobile"] as const).find((s) => s === raw.route) ?? null,
    notify: coerceBool(raw.notify),
    raw,
  };
}

export async function submitLead(
  user: string,
  raw: Record<string, unknown>,
  lang: Lang,
): Promise<SubmitResult> {
  const lead = normalizeLead(user, raw);

  // Minimum-viable validation: we need a scheme. Everything else is scheme-specific
  // and enforced by the Flow JSON's `required` attribute, so we trust it here.
  if (!lead.scheme) {
    log("ONBOARDING_FAILED", { user, lang, reason: "missing_scheme", raw });
    return { ok: false, lead, error: "missing_scheme" };
  }

  let webhookStatus: number | undefined;
  let webhookError: string | undefined;
  if (LEAD_WEBHOOK_URL) {
    try {
      const res = await fetch(LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...lead, lang, ts: new Date().toISOString() }),
      });
      webhookStatus = res.status;
      if (!res.ok) webhookError = `HTTP ${res.status}`;
    } catch (err) {
      webhookError = String(err);
    }
  }

  log("ONBOARDING_LEAD_SUBMITTED", {
    user,
    scheme: lead.scheme,
    hasPhone: Boolean(lead.phone),
    hasNida: Boolean(lead.nida),
    consent: lead.consent,
    webhook: Boolean(LEAD_WEBHOOK_URL),
    status: webhookStatus,
    ...(webhookError ? { webhookError } : {}),
  });

  return { ok: !webhookError, lead, webhookStatus, error: webhookError };
}

// ─── Tool 2: captureFeedback ────────────────────────────────────────────────

export type FeedbackRating = "up" | "down";

export function captureFeedback(user: string, rating: FeedbackRating, note?: string): void {
  log("ONBOARDING_FEEDBACK", { user, rating, ...(note ? { note } : {}) });
}

// ─── Tool 3: resolveOnboardingUrl ───────────────────────────────────────────

const SCHEME_URL_ENV: Record<Scheme, string> = {
  utt: "UTT_ONBOARDING_URL",
  dse: "DSE_ONBOARDING_URL",
  govsec: "GOVSEC_ONBOARDING_URL",
  pension: "PENSION_ONBOARDING_URL",
};

export function resolveOnboardingUrl(scheme: Scheme | null): string | null {
  if (!scheme) return null;
  const url = Deno.env.get(SCHEME_URL_ENV[scheme]) ?? "";
  return url.trim() || null;
}

// ─── Tool 4: handleFailure ──────────────────────────────────────────────────

const FAIL_COPY: Record<Lang, { body: string; retry: string; menu: string }> = {
  en: {
    body: "Something went wrong finishing your registration. Your details were not submitted — please try again.",
    retry: "Try again",
    menu: "Back to modes",
  },
  sw: {
    body: "Kuna hitilafu wakati wa kumaliza usajili wako. Taarifa zako hazikutumwa — tafadhali jaribu tena.",
    retry: "Jaribu tena",
    menu: "Rudi kwenye hali",
  },
};

export async function handleFailure(
  to: string,
  reason: string,
  lang: Lang,
  send: Sender,
): Promise<void> {
  log("ONBOARDING_FAILED", { user: to, lang, reason });
  const copy = FAIL_COPY[lang];
  await send({
    to,
    kind: "buttons",
    body: copy.body,
    buttons: [
      { id: "mode_onboarding", title: copy.retry },
      { id: "go_modes", title: copy.menu },
    ],
  });
}
