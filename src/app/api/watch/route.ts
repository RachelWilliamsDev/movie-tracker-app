import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  contentId?: number;
  mediaType?: string;
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

  if (!Number.isFinite(contentId) || contentId <= 0 || !mediaType) {
    return NextResponse.json(
      { error: "contentId (positive number) and mediaType (movie|tv) are required" },
      { status: 400 }
    );
  }

  try {
    await prisma.userWatch.create({
      data: {
        userId,
        contentId,
        mediaType
      }
    });
    return NextResponse.json({ ok: true, created: true });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code?: string }).code)
        : "";
    if (code === "P2002") {
      return NextResponse.json({ ok: true, created: false, alreadyWatched: true });
    }
    throw e;
  }
}
