import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { WatchSource, WatchStatus } from "@prisma/client";
import { resolveUserActivityAccess } from "@/lib/activity-visibility";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Keep in sync with Prisma `WatchSource` enum (explicit list avoids bundler issues with `Object.values`). */
const WATCH_SOURCE_VALUES = [
  "NETFLIX",
  "DISNEY_PLUS",
  "PRIME_VIDEO",
  "OTHER"
] as const satisfies readonly WatchSource[];

const WATCH_SOURCES = new Set<string>(WATCH_SOURCE_VALUES);

/** Keep in sync with Prisma `WatchStatus` enum. */
const WATCH_STATUS_VALUES = ["WATCHING", "COMPLETED", "WANT_TO_WATCH"] as const satisfies readonly WatchStatus[];

const WATCH_STATUSES = new Set<string>(WATCH_STATUS_VALUES);

/**
 * MVP rule for `watchSource` vs `watchStatus`:
 * - COMPLETED: when `watchSource` is omitted/null, default to OTHER.
 * - WATCHING | WANT_TO_WATCH: `watchSource` is optional; omit or null clears stored source.
 */
type Body = {
  contentId?: number;
  mediaType?: string;
  watchStatus?: string;
  watchSource?: string | null;
};

function parseTargetUserId(request: Request): string | null {
  const url = new URL(request.url);
  const raw = url.searchParams.get("userId")?.trim() ?? "";
  return raw.length > 0 ? raw : null;
}

export async function GET(request: Request) {
  const targetUserId = parseTargetUserId(request);
  if (!targetUserId) {
    return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;

  try {
    const access = await resolveUserActivityAccess(viewerId, targetUserId);
    if (!access.targetExists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ ok: true, watches: [] });
    }

    const watches = await prisma.userWatch.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ ok: true, watches });
  } catch {
    return NextResponse.json({ error: "Could not load watches." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contentId = Number(body.contentId);
  const mediaType = body.mediaType === "tv" ? "tv" : body.mediaType === "movie" ? "movie" : null;
  const rawStatus = body.watchStatus;
  const rawSource = body.watchSource;

  if (!Number.isFinite(contentId) || contentId <= 0 || !mediaType) {
    return NextResponse.json(
      { error: "contentId (positive number) and mediaType (movie|tv) are required" },
      { status: 400 }
    );
  }

  if (typeof rawStatus !== "string" || !WATCH_STATUSES.has(rawStatus)) {
    return NextResponse.json(
      {
        error:
          "watchStatus is required and must be one of: WATCHING, COMPLETED, WANT_TO_WATCH"
      },
      { status: 400 }
    );
  }

  const watchStatus = rawStatus as WatchStatus;

  let watchSource: WatchSource | null = null;
  if (rawSource != null && rawSource !== "") {
    if (typeof rawSource !== "string" || !WATCH_SOURCES.has(rawSource)) {
      return NextResponse.json(
        {
          error: "watchSource must be one of: NETFLIX, DISNEY_PLUS, PRIME_VIDEO, OTHER"
        },
        { status: 400 }
      );
    }
    watchSource = rawSource as WatchSource;
  }

  if (watchStatus === "COMPLETED" && watchSource == null) {
    watchSource = "OTHER";
  }

  try {
    await prisma.userWatch.upsert({
      where: {
        userId_contentId_mediaType: {
          userId,
          contentId,
          mediaType
        }
      },
      create: {
        userId,
        contentId,
        mediaType,
        watchStatus,
        watchSource
      },
      update: {
        watchStatus,
        watchSource
      }
    });

    return NextResponse.json({ ok: true, watchStatus, watchSource });
  } catch {
    return NextResponse.json({ error: "Could not save watch." }, { status: 500 });
  }
}
