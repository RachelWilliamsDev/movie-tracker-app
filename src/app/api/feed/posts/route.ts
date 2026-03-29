import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import type { Prisma, ProfileVisibility } from "@prisma/client";
import { canViewUserActivityFromPolicy } from "@/lib/activity-visibility-policy";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  authorSelect,
  mapPostRowToFeedItem,
  type FeedPostRow
} from "@/lib/unified-feed-post-mapper";

/**
 * GET /api/feed/posts — MEM-86 unified feed (chronological `Post` rows for followed users).
 *
 * Query:
 * - `limit` (optional, default 20, max 50)
 * - `cursor` (optional): opaque token from `pagination.nextCursor` — keyset on (`createdAt`, `id`) desc
 * - `offset` (optional): non-negative integer; only when `cursor` is omitted (same pattern as `/api/activity/feed`)
 *
 * Auth: session required. 401 if absent.
 *
 * Success 200:
 * ```json
 * {
 *   "ok": true,
 *   "items": [
 *     {
 *       "id": "<post cuid>",
 *       "type": "ACTIVITY" | "SHARE",
 *       "content": string | null,
 *       "metadata": {},
 *       "createdAt": "<ISO8601>",
 *       "author": { "id", "username", "displayName" },
 *       "media": { "kind": "MOVIE" | "TV", "tmdbId": number, "detailPath": "/show/..." }
 *     }
 *   ],
 *   "pagination": { "limit", "hasMore", "nextCursor", "nextOffset" }
 * }
 * ```
 *
 * Ordering: newest first across `ACTIVITY` and `SHARE`. Privacy: same rules as activity feed
 * (`canViewUserActivityFromPolicy` on the post author).
 *
 * Full contract + mixed-type verification: `docs/feed-posts-api.md`.
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type CursorPayload = { t: string; i: string };

function parseLimit(raw: string | null): number {
  if (raw == null || raw === "") {
    return DEFAULT_LIMIT;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(n, MAX_LIMIT);
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(raw: string): CursorPayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const v = JSON.parse(json) as unknown;
    if (
      v != null &&
      typeof v === "object" &&
      "t" in v &&
      "i" in v &&
      typeof (v as CursorPayload).t === "string" &&
      typeof (v as CursorPayload).i === "string"
    ) {
      return v as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function postVisibleInFeed(
  viewerId: string,
  authorId: string,
  profileVisibility: ProfileVisibility
): boolean {
  return canViewUserActivityFromPolicy({
    viewerId,
    targetUserId: authorId,
    profileVisibility,
    followApprovalStatus: profileVisibility === "PRIVATE" ? "APPROVED" : null
  });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursorRaw = url.searchParams.get("cursor")?.trim() ?? "";
  const offsetRaw = url.searchParams.get("offset")?.trim() ?? "";

  const follows = await prisma.userFollow.findMany({
    where: { followerId: viewerId, approvalStatus: "APPROVED" },
    select: { followingId: true }
  });
  const followingIds = [...new Set(follows.map((f) => f.followingId))];

  if (followingIds.length === 0) {
    return NextResponse.json({
      ok: true,
      items: [],
      pagination: {
        limit,
        hasMore: false,
        nextCursor: null,
        nextOffset: null
      }
    });
  }

  const baseWhere: Prisma.PostWhereInput = {
    userId: { in: followingIds }
  };

  let where: Prisma.PostWhereInput = baseWhere;
  let skip: number | undefined;

  if (cursorRaw.length > 0) {
    const cur = decodeCursor(cursorRaw);
    if (!cur) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    const createdAt = new Date(cur.t);
    if (Number.isNaN(createdAt.getTime())) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    where = {
      AND: [
        baseWhere,
        {
          OR: [
            { createdAt: { lt: createdAt } },
            {
              AND: [{ createdAt }, { id: { lt: cur.i } }]
            }
          ]
        }
      ]
    };
  } else if (offsetRaw.length > 0) {
    const offset = Number(offsetRaw);
    if (!Number.isInteger(offset) || offset < 0) {
      return NextResponse.json({ error: "offset must be a non-negative integer" }, { status: 400 });
    }
    skip = offset;
  }

  const rows: FeedPostRow[] = await prisma.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(skip != null ? { skip } : {}),
    take: limit + 1,
    include: {
      user: {
        select: authorSelect
      }
    }
  });

  const visible = rows.filter((row) =>
    postVisibleInFeed(viewerId, row.userId, row.user.profileVisibility)
  );

  const hasMore = visible.length > limit;
  const page = hasMore ? visible.slice(0, limit) : visible;
  const last = page[page.length - 1];

  const nextCursor =
    hasMore && last != null
      ? encodeCursor({ t: last.createdAt.toISOString(), i: last.id })
      : null;

  let nextOffset: number | null = null;
  if (cursorRaw.length === 0 && offsetRaw.length > 0) {
    const offset = Number(offsetRaw);
    nextOffset = hasMore ? offset + page.length : null;
  }

  const items = page.map(mapPostRowToFeedItem);

  return NextResponse.json({
    ok: true,
    items,
    pagination: {
      limit,
      hasMore,
      nextCursor,
      nextOffset
    }
  });
}
