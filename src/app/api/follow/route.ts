import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { followUser } from "@/lib/follow-service";

type Body = {
  userId?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const followerId = session?.user?.id;
  if (!followerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const followingId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!followingId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const state = await followUser({ followerId, followingId });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    if (error instanceof Error && error.message === "Cannot follow yourself.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "User not found." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not follow user." }, { status: 500 });
  }
}
