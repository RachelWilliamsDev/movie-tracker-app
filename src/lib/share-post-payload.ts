import type { ApiErrorCode } from "@/lib/api-errors";

/** MEM-89: optional share caption; plain text, same cap as comments MVP. */
export const SHARE_POST_CONTENT_MAX = 2000;

const RATING_MIN = 1;
const RATING_MAX = 5;

export type SharePostMediaKind = "MOVIE" | "TV";

export type ParsedSharePostPayload = {
  mediaKind: SharePostMediaKind;
  tmdbId: number;
  content: string | null;
  /** Present only when client sent a numeric rating (1–5). */
  rating: number | undefined;
};

export type ParseSharePostBodyResult =
  | { ok: true; data: ParsedSharePostPayload }
  | { ok: false; error: string; code: ApiErrorCode };

/**
 * Validates JSON body for POST /api/posts/share (MEM-89).
 */
export function parseSharePostBody(body: unknown): ParseSharePostBodyResult {
  if (body == null || typeof body !== "object") {
    return {
      ok: false,
      error: "Request body must be a JSON object",
      code: "BAD_REQUEST"
    };
  }

  const o = body as Record<string, unknown>;

  const rawKind = o.mediaKind;
  let mediaKind: SharePostMediaKind | null = null;
  if (rawKind === "MOVIE" || rawKind === "movie") {
    mediaKind = "MOVIE";
  } else if (rawKind === "TV" || rawKind === "tv") {
    mediaKind = "TV";
  } else {
    return {
      ok: false,
      error: "mediaKind must be MOVIE or TV",
      code: "SHARE_POST_INVALID_MEDIA"
    };
  }

  const rawId = o.tmdbId;
  const tmdbId =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number.parseInt(rawId, 10)
        : NaN;
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return {
      ok: false,
      error: "tmdbId must be a positive integer",
      code: "SHARE_POST_INVALID_MEDIA"
    };
  }

  let content: string | null = null;
  if (Object.hasOwn(o, "content")) {
    const c = o.content;
    if (c == null) {
      content = null;
    } else if (typeof c !== "string") {
      return {
        ok: false,
        error: "content must be a string or null",
        code: "BAD_REQUEST"
      };
    } else {
      const t = c.trim();
      if (t.length > SHARE_POST_CONTENT_MAX) {
        return {
          ok: false,
          error: `content must be at most ${SHARE_POST_CONTENT_MAX} characters`,
          code: "BAD_REQUEST"
        };
      }
      content = t.length > 0 ? t : null;
    }
  }

  let rating: number | undefined;
  if (Object.hasOwn(o, "rating")) {
    const r = o.rating;
    if (r == null) {
      rating = undefined;
    } else {
      const n = typeof r === "number" ? r : Number(r);
      if (!Number.isInteger(n) || n < RATING_MIN || n > RATING_MAX) {
        return {
          ok: false,
          error: `rating must be an integer between ${RATING_MIN} and ${RATING_MAX}`,
          code: "BAD_REQUEST"
        };
      }
      rating = n;
    }
  }

  return {
    ok: true,
    data: { mediaKind, tmdbId, content, rating }
  };
}

export function mediaTypeStringForPost(kind: SharePostMediaKind): "movie" | "tv" {
  return kind === "MOVIE" ? "movie" : "tv";
}
