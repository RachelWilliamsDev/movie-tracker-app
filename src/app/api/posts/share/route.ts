import { Prisma, type PostMediaKind } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { scheduleUserActivityEvent } from "@/lib/activity-events";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import {
  mediaTypeStringForPost,
  parseSharePostBody
} from "@/lib/share-post-payload";

/**
 * POST /api/posts/share — MEM-89 create a `SHARE` post (optional caption + optional first-time rating).
 *
 * Body JSON:
 * - `mediaKind` (required): `MOVIE` | `TV` (case-insensitive `movie` / `tv` accepted)
 * - `tmdbId` (required): positive integer TMDB id
 * - `content` (optional): trimmed caption, max 2000 chars (plain text; XSS policy like comments)
 * - `rating` (optional): integer 1–5 **only allowed if** the user has **no** `UserRating` for this title yet
 *
 * **201** `{ ok: true, post: { id, type, content, mediaKind, tmdbId, metadata, createdAt } }`
 *
 * **401** unauthenticated. **400** invalid payload (`SHARE_POST_INVALID_MEDIA`, `BAD_REQUEST`).
 * **400** `SHARE_POST_ALREADY_RATED` if `rating` sent but a rating row already exists.
 * **429** `SHARE_POST_THROTTLED` — max 120 SHARE posts per user per rolling hour (abuse guard).
 *
 * New rows are returned by `GET /api/feed/posts` for followers (MEM-86).
 *
 * Full notes: `docs/share-post-api.md`.
 */
const SHARE_POSTS_PER_HOUR_MAX = 120;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonApiError(400, "Invalid JSON", "BAD_REQUEST");
  }

  const parsed = parseSharePostBody(body);
  if (!parsed.ok) {
    return jsonApiError(400, parsed.error, parsed.code);
  }

  const { mediaKind, tmdbId, content, rating } = parsed.data;
  const mediaType = mediaTypeStringForPost(mediaKind);
  const prismaMediaKind: PostMediaKind = mediaKind;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentShares = await prisma.post.count({
    where: {
      userId,
      type: "SHARE",
      createdAt: { gte: hourAgo }
    }
  });
  if (recentShares >= SHARE_POSTS_PER_HOUR_MAX) {
    return jsonApiError(
      429,
      "Too many share posts. Try again later.",
      "SHARE_POST_THROTTLED"
    );
  }

  if (rating != null) {
    const existingRating = await prisma.userRating.findUnique({
      where: {
        userId_contentId_mediaType: {
          userId,
          contentId: tmdbId,
          mediaType
        }
      }
    });
    if (existingRating) {
      return jsonApiError(
        400,
        "You already rated this title; omit rating or update it from the title page.",
        "SHARE_POST_ALREADY_RATED"
      );
    }
  }

  const watch = await prisma.userWatch.findUnique({
    where: {
      userId_contentId_mediaType: {
        userId,
        contentId: tmdbId,
        mediaType
      }
    },
    select: { watchStatus: true }
  });

  const metadata: Prisma.InputJsonValue = {
    share: true,
    mediaType,
    ...(rating != null ? { rating } : {}),
    ...(watch != null ? { watchStatus: watch.watchStatus } : {})
  };

  const createdAt = new Date();

  try {
    const post = await prisma.$transaction(async (tx) => {
      if (rating != null) {
        await tx.userRating.create({
          data: {
            userId,
            contentId: tmdbId,
            mediaType,
            rating
          }
        });
      }

      return tx.post.create({
        data: {
          userId,
          type: "SHARE",
          content,
          mediaKind: prismaMediaKind,
          tmdbId,
          metadata,
          createdAt,
          sourceActivityEventId: null
        }
      });
    });

    if (rating != null) {
      scheduleUserActivityEvent(userId, "RATED", {
        contentId: tmdbId,
        mediaType,
        rating
      });
    }

    return NextResponse.json(
      {
        ok: true,
        post: {
          id: post.id,
          type: post.type,
          content: post.content,
          mediaKind: post.mediaKind,
          tmdbId: post.tmdbId,
          metadata: post.metadata,
          createdAt: post.createdAt.toISOString()
        }
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonApiError(
        400,
        "You already rated this title; omit rating or update it from the title page.",
        "SHARE_POST_ALREADY_RATED"
      );
    }
    return jsonApiError(500, "Could not create share post.", "SHARE_POST_FAILED");
  }
}
