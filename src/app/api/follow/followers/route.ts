import { NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { userPublicDisplayName } from "@/lib/user-search";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type FollowerItem = {
  userId: string;
  /** Stored handle; null if unset (FEAT-134). */
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  followedAt: string;
};

function parseLimit(raw: string | null): number {
  if (!raw) {
    return DEFAULT_LIMIT;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(n, MAX_LIMIT);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return jsonApiError(400, "userId is required", "BAD_REQUEST");
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor")?.trim() || null;

  try {
    const exists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    if (!exists) {
      return jsonApiError(404, "User not found.", "NOT_FOUND");
    }

    const rows = await prisma.userFollow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    const followers: FollowerItem[] = page.map((row) => ({
      userId: row.follower.id,
      username: row.follower.username,
      displayName: userPublicDisplayName(row.follower),
      avatarUrl: null,
      followedAt: row.createdAt.toISOString()
    }));

    return NextResponse.json({
      ok: true,
      followers,
      pagination: {
        limit,
        hasMore,
        nextCursor
      }
    });
  } catch {
    return jsonApiError(
      500,
      "Could not fetch followers.",
      "FOLLOWERS_LIST_FAILED"
    );
  }
}
