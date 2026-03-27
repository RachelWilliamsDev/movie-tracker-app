import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type FollowerItem = {
  userId: string;
  username: string;
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
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor")?.trim() || null;

  try {
    const rows = await prisma.userFollow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            email: true
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
      username: row.follower.name?.trim() || row.follower.email,
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
    return NextResponse.json({ error: "Could not fetch followers." }, { status: 500 });
  }
}
