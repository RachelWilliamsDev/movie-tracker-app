import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { WatchSource, WatchStatus } from "@prisma/client";
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
 * - COMPLETED: `watchSource` is required (where you finished the title).
 * - WATCHING | WANT_TO_WATCH: `watchSource` is optional; omit or null clears stored source.
 */
type Body = {
  contentId?: number;
  mediaType?: string;
  watchStatus?: string;
  watchSource?: string | null;
};

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
    return NextResponse.json(
      { error: "watchSource is required when watchStatus is COMPLETED" },
      { status: 400 }
    );
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
