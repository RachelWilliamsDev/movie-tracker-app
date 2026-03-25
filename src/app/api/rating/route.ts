import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN = 1;
const MAX = 5;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    contentId?: number;
    mediaType?: string;
    rating?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contentId = Number(body.contentId);
  const mediaType = body.mediaType === "tv" ? "tv" : body.mediaType === "movie" ? "movie" : null;
  const rating = Number(body.rating);

  if (!Number.isFinite(contentId) || contentId <= 0 || !mediaType) {
    return NextResponse.json(
      { error: "contentId (positive number) and mediaType (movie|tv) are required" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(rating) || rating < MIN || rating > MAX) {
    return NextResponse.json({ error: `rating must be an integer between ${MIN} and ${MAX}` }, { status: 400 });
  }

  try {
    await prisma.userRating.upsert({
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
        rating
      },
      update: {
        rating
      }
    });

    return NextResponse.json({ ok: true, rating });
  } catch {
    return NextResponse.json({ error: "Could not save rating." }, { status: 500 });
  }
}
