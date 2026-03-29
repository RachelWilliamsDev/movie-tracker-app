import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import type { Prisma, ProfileVisibility } from "@prisma/client";
import { canViewUserActivityFromPolicy } from "@/lib/activity-visibility-policy";
import { resolveUserActivityAccess } from "@/lib/activity-visibility";
import { authOptions } from "@/lib/auth";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  parseFeedLimit
} from "@/lib/feed-post-cursor";
import { prisma } from "@/lib/prisma";
import {
  authorSelect,
  mapPostRowToFeedItem,
  type FeedPostRow
} from "@/lib/unified-feed-post-mapper";

/**
 * GET /api/users/[userId]/posts — chronological `Post` rows for one user (profile “Recent activity”).
 *
 * Auth: optional. **403** if the viewer may not see this member’s activity (private / not following).
 * **404** if `userId` is not a valid user id shape or user missing (align with profile pages).
 *
 * Query: same as `/api/feed/posts` (`limit`, `cursor`, `offset`).
 */
function postVisibleForViewer(
  viewerId: string | null,
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

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { userId: rawId } = await context.params;
  const targetUserId = rawId?.trim() ?? "";
  if (!targetUserId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;

  const access = await resolveUserActivityAccess(viewerId, targetUserId);
  if (!access.targetExists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = parseFeedLimit(url.searchParams.get("limit"));
  const cursorRaw = url.searchParams.get("cursor")?.trim() ?? "";
  const offsetRaw = url.searchParams.get("offset")?.trim() ?? "";

  const baseWhere: Prisma.PostWhereInput = {
    userId: targetUserId
  };

  let where: Prisma.PostWhereInput = baseWhere;
  let skip: number | undefined;

  if (cursorRaw.length > 0) {
    const cur = decodeFeedCursor(cursorRaw);
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
      return NextResponse.json(
        { error: "offset must be a non-negative integer" },
        { status: 400 }
      );
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
    postVisibleForViewer(viewerId, row.userId, row.user.profileVisibility)
  );

  const hasMore = visible.length > limit;
  const page = hasMore ? visible.slice(0, limit) : visible;
  const last = page[page.length - 1];

  const nextCursor =
    hasMore && last != null
      ? encodeFeedCursor({ t: last.createdAt.toISOString(), i: last.id })
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
