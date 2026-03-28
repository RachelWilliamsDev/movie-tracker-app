import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { resolveUserActivityAccess } from "@/lib/activity-visibility";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      return NextResponse.json({ ok: true, progress: [] });
    }

    const progress = await prisma.userTvEpisodeProgress.findMany({
      where: { userId: targetUserId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
    });

    return NextResponse.json({ ok: true, progress });
  } catch {
    return NextResponse.json({ error: "Could not load progress." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    contentId?: number;
    mediaType?: string;
    seasonNumber?: number;
    episodeNumber?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contentId = Number(body.contentId);
  const mediaType = body.mediaType === "tv" ? "tv" : null;
  const seasonNumber = Number(body.seasonNumber);
  const episodeNumber = Number(body.episodeNumber);

  if (!Number.isFinite(contentId) || contentId <= 0 || !mediaType) {
    return NextResponse.json({ error: "contentId (positive number) and mediaType (tv) are required" }, { status: 400 });
  }
  if (!Number.isFinite(seasonNumber) || seasonNumber <= 0) {
    return NextResponse.json({ error: "seasonNumber (positive number) is required" }, { status: 400 });
  }
  if (!Number.isFinite(episodeNumber) || episodeNumber <= 0) {
    return NextResponse.json({ error: "episodeNumber (positive number) is required" }, { status: 400 });
  }

  try {
    await prisma.userTvEpisodeProgress.upsert({
      where: {
        userId_contentId_mediaType_seasonNumber: {
          userId,
          contentId,
          mediaType,
          seasonNumber
        }
      },
      create: {
        userId,
        contentId,
        mediaType,
        seasonNumber,
        episodeNumber
      },
      update: {
        episodeNumber
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save progress." }, { status: 500 });
  }
}

