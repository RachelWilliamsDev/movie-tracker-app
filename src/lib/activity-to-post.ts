import type { ActivityEventType, PostMediaKind, PostType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const FEED_ACTIVITY_TYPES = new Set<ActivityEventType>([
  "WATCH_COMPLETED",
  "RATED"
]);

export type PostCreateFromActivity = {
  userId: string;
  type: PostType;
  content: null;
  mediaKind: PostMediaKind;
  tmdbId: number;
  metadata: Prisma.InputJsonValue;
  createdAt: Date;
  sourceActivityEventId: string;
};

/**
 * Maps a `UserActivityEvent` feed row to a `Post` create payload (MEM-85).
 * Skips events with missing/invalid TMDB metadata.
 */
export function mapUserActivityEventToPost(
  event: {
    id: string;
    actorId: string;
    type: ActivityEventType;
    metadata: unknown;
    createdAt: Date;
  }
):
  | { ok: true; data: PostCreateFromActivity }
  | { ok: false; reason: string } {
  if (!FEED_ACTIVITY_TYPES.has(event.type)) {
    return { ok: false, reason: `unsupported type: ${event.type}` };
  }

  const meta =
    event.metadata != null &&
    typeof event.metadata === "object" &&
    !Array.isArray(event.metadata)
      ? (event.metadata as Record<string, unknown>)
      : {};

  const rawId = meta.contentId;
  const tmdbId =
    typeof rawId === "number"
      ? rawId
      : Number(typeof rawId === "string" ? rawId : NaN);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return { ok: false, reason: "missing or invalid contentId" };
  }

  const mt = meta.mediaType;
  if (mt !== "movie" && mt !== "tv") {
    return { ok: false, reason: "missing or invalid mediaType" };
  }

  const mediaKind: PostMediaKind = mt === "movie" ? "MOVIE" : "TV";

  const metadata = Object.assign({}, meta, {
    activityType: event.type
  }) as Prisma.InputJsonValue;

  return {
    ok: true,
    data: {
      userId: event.actorId,
      type: "ACTIVITY",
      content: null,
      mediaKind,
      tmdbId,
      metadata,
      createdAt: event.createdAt,
      sourceActivityEventId: event.id
    }
  };
}
