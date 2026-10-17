// Shared Deno KV handle for the whole project.
//
// Deno.openKv() accepts three kinds of path:
//   1. undefined                              → per-script local SQLite (default)
//   2. absolute filesystem path               → specific local SQLite file
//   3. "https://api.deno.com/databases/<uuid>/connect"
//                                             → REMOTE Deno Deploy KV database
//                                             (requires DENO_KV_ACCESS_TOKEN)
//
// On Deno Deploy with no env, the project auto-shares a managed KV database.
// Locally, set KV_PATH to point at the same database (file for same-machine,
// remote URL + token to read production from a laptop).
//
// Call openKv() once per process — handle is cached.

let cached: Promise<Deno.Kv> | null = null;

export function openKv(): Promise<Deno.Kv> {
  if (cached) return cached;
  const path = Deno.env.get("KV_PATH")?.trim() || undefined;
  if (path && /^https?:\/\//i.test(path) && !Deno.env.get("DENO_KV_ACCESS_TOKEN")) {
    throw new Error(
      `KV_PATH is a remote URL (${path}) but DENO_KV_ACCESS_TOKEN is not set — connection would fail. Set the token or use a local path.`,
    );
  }
  cached = Deno.openKv(path);
  return cached;
}

/** Reset the cache. Tests only — never call in production. */
export function _resetKvCacheForTests(): void {
  cached = null;
}
