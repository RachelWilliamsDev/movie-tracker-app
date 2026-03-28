import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import type { ActivityEventType, Prisma, ProfileVisibility } from "@prisma/client";
import { canViewUserActivityFromPolicy } from "@/lib/activity-visibility-policy";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const FEED_EVENT_TYPES = ["WATCH_COMPLETED", "RATED"] as const satisfies readonly ActivityEventType[];

const actorSelect = {
  id: true,
  name: true,
  email: true,
  profileVisibility: true
} as const;

type FeedRow = Prisma.UserActivityEventGetPayload<{
  include: { actor: { select: typeof actorSelect } };
}>;

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

function activityVisibleInFeed(
  viewerId: string,
  actorId: string,
  profileVisibility: ProfileVisibility
): boolean {
  return canViewUserActivityFromPolicy({
    viewerId,
    targetUserId: actorId,
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

  const baseWhere: Prisma.UserActivityEventWhereInput = {
    actorId: { in: followingIds },
    type: { in: [...FEED_EVENT_TYPES] }
  };

  let where: Prisma.UserActivityEventWhereInput = baseWhere;
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

  const rows: FeedRow[] = await prisma.userActivityEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(skip != null ? { skip } : {}),
    take: limit + 1,
    include: {
      actor: {
        select: actorSelect
      }
    }
  });

  const visible = rows.filter((row) =>
    activityVisibleInFeed(viewerId, row.actorId, row.actor.profileVisibility)
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

  return NextResponse.json({
    ok: true,
    items: page.map((row) => ({
      id: row.id,
      type: row.type,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      actor: {
        id: row.actor.id,
        username: row.actor.name?.trim() || row.actor.email
      }
    })),
    pagination: {
      limit,
      hasMore,
      nextCursor,
      nextOffset
    }
  });
}
