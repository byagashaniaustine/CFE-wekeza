// Shared Supabase client factory.
//
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment at
// first access and caches a single client per process. The service role key
// bypasses RLS — ONLY the bot process should hold it. The dashboard uses the
// anon (publishable) key via its own client (dashboard/.env).
//
// If either env var is missing we return null; the caller (session.ts /
// metrics.ts) falls back to the in-memory stores so local dev + tests keep
// working without Supabase credentials.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
let probed = false;

export function getSupabase(): SupabaseClient | null {
  if (probed) return cached;
  probed = true;
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!url || !key) {
    // Deliberate: not an error. The absence of creds signals "use in-memory
    // storage" — the only case where that happens in production would be a
    // deploy misconfiguration, which gets flagged by /admin/health.
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-client-info": "cfe-wekeza-bot" } },
  });
  return cached;
}

/** Reset the cached client (tests only). */
export function _resetSupabaseForTests(): void {
  cached = null;
  probed = false;
}

/** For /admin/health — what the bot is currently talking to. */
export function describeStorageTarget(): "supabase" | "memory" {
  return getSupabase() ? "supabase" : "memory";
}
