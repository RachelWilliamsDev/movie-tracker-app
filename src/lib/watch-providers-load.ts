import { cache } from "react";
import { tmdbFetch } from "@/lib/tmdb";
import { getWatchProvidersRegion } from "@/lib/watch-providers-region";
import {
  normalizeWhereToWatch,
  type TmdbWatchProvidersResponse,
  type WhereToWatchPayload
} from "@/lib/watch-providers-normalize";

/** TMDB watch/provider data changes slowly; align with MEM-99. */
const WATCH_PROVIDERS_REVALIDATE_SEC = 86_400;

/**
 * Cached per-request: duplicate calls with same args share one TMDB fetch (React `cache()`).
 */
export const loadWhereToWatch = cache(
  async (
    mediaType: "movie" | "tv",
    tmdbId: number
  ): Promise<WhereToWatchPayload> => {
    const region = getWatchProvidersRegion();
    const path =
      mediaType === "movie"
        ? `/movie/${tmdbId}/watch/providers`
        : `/tv/${tmdbId}/watch/providers`;

    const raw = await tmdbFetch<TmdbWatchProvidersResponse>(
      path,
      {},
      { revalidate: WATCH_PROVIDERS_REVALIDATE_SEC }
    );

    return normalizeWhereToWatch(raw, region);
  }
);
