import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

