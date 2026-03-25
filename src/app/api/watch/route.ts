import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { WatchSource } from "@prisma/client";
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

type Body = {
  contentId?: number;
  mediaType?: string;
  watchSource?: string;
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
  const rawSource = body.watchSource;

  if (!Number.isFinite(contentId) || contentId <= 0 || !mediaType) {
    return NextResponse.json(
      { error: "contentId (positive number) and mediaType (movie|tv) are required" },
      { status: 400 }
    );
  }

  if (typeof rawSource !== "string" || !WATCH_SOURCES.has(rawSource)) {
    return NextResponse.json(
      {
        error: "watchSource is required and must be one of: NETFLIX, DISNEY_PLUS, PRIME_VIDEO, OTHER"
      },
      { status: 400 }
    );
  }

  const watchSource = rawSource as WatchSource;

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
        watchSource
      },
      update: {
        watchSource
      }
    });

    return NextResponse.json({ ok: true, watchSource });
  } catch {
    return NextResponse.json({ error: "Could not save watch." }, { status: 500 });
  }
}
