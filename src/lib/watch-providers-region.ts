/**
 * TMDB “watch providers” responses are keyed by **ISO 3166-1 alpha-2** region
 * (e.g. `GB`, `US`). This module is the **single** place that resolves which
 * region the server uses for those API calls.
 *
 * ## MVP
 *
 * Read **`WATCH_PROVIDERS_REGION`** from the environment (server-only). If unset,
 * empty, or invalid, the region defaults to **`GB`** (United Kingdom).
 *
 * ## Future (not implemented)
 *
 * User-level region (profile setting, locale, or geo) should be resolved **here**
 * or via a thin wrapper (e.g. `getWatchProvidersRegionForViewer(viewerId)`), so
 * route handlers and UI never hardcode country codes.
 */

const DEFAULT_WATCH_PROVIDERS_REGION = "GB" as const;

/** TMDB-compatible ISO 3166-1 alpha-2 code (uppercase). */
export type WatchProvidersRegionCode = string;

function normalizeWatchProvidersRegion(
  raw: string | undefined
): WatchProvidersRegionCode {
  if (raw == null) {
    return DEFAULT_WATCH_PROVIDERS_REGION;
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return DEFAULT_WATCH_PROVIDERS_REGION;
  }
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) {
    return upper;
  }
  return DEFAULT_WATCH_PROVIDERS_REGION;
}

/**
 * Region used for TMDB `/movie/{id}/watch/providers` and `/tv/{id}/watch/providers`.
 * Call only from **server** code (Server Components, Route Handlers, server actions).
 */
export function getWatchProvidersRegion(): WatchProvidersRegionCode {
  return normalizeWatchProvidersRegion(process.env.WATCH_PROVIDERS_REGION);
}

export { DEFAULT_WATCH_PROVIDERS_REGION };
