import type { ActivityEventType, WatchSource } from "@prisma/client";
import { tmdbFetch } from "@/lib/tmdb";
import { WATCH_SOURCE_LABEL } from "@/lib/watch-source";

const WATCH_SOURCE_KEYS = new Set<string>([
  "NETFLIX",
  "DISNEY_PLUS",
  "PRIME_VIDEO",
  "OTHER"
]);

function watchSourceLabel(raw: unknown): string {
  if (typeof raw !== "string" || !WATCH_SOURCE_KEYS.has(raw)) {
    return WATCH_SOURCE_LABEL.OTHER;
  }
  return WATCH_SOURCE_LABEL[raw as WatchSource];
}

async function resolveContentTitle(
  contentId: number,
  mediaType: "movie" | "tv"
): Promise<string | null> {
  try {
    if (mediaType === "movie") {
      const d = await tmdbFetch<{ title?: string }>(
        `/movie/${contentId}`,
        { language: "en-US" },
        { revalidate: 3600 }
      );
      return d.title ?? null;
    }
    const d = await tmdbFetch<{ name?: string }>(
      `/tv/${contentId}`,
      { language: "en-US" },
      { revalidate: 3600 }
    );
    return d.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Human-readable line for the friends activity feed (TMDB title when available).
 */
export async function buildActivityFeedSentence(
  actorDisplayName: string,
  type: ActivityEventType,
  metadata: unknown
): Promise<string> {
  const meta =
    metadata != null && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : {};
  const rawId = meta.contentId;
  const contentId =
    typeof rawId === "number" ? rawId : Number(typeof rawId === "string" ? rawId : NaN);
  const mediaType =
    meta.mediaType === "tv" || meta.mediaType === "movie" ? meta.mediaType : null;

  let title: string | null = null;
  if (Number.isFinite(contentId) && contentId > 0 && mediaType != null) {
    title = await resolveContentTitle(contentId, mediaType);
  }
  const displayTitle = title ?? "a title";

  if (type === "WATCH_COMPLETED") {
    const src = watchSourceLabel(meta.watchSource);
    return `${actorDisplayName} watched ${displayTitle} (${src})`;
  }

  if (type === "RATED") {
    const r = typeof meta.rating === "number" ? meta.rating : Number(meta.rating);
    const rs = Number.isInteger(r) && r >= 1 && r <= 5 ? String(r) : "?";
    return `${actorDisplayName} rated ${displayTitle} ${rs}/5`;
  }

  return `${actorDisplayName} was active`;
}
