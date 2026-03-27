import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { followUser, unfollowUser } from "@/lib/follow-service";

type Body = {
  userId?: string;
};

async function parseBody(request: Request): Promise<Body | null> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return null;
  }
  return body;
}

async function getActorId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function parseTargetId(body: Body): string {
  return typeof body.userId === "string" ? body.userId.trim() : "";
}

export async function POST(request: Request) {
  const followerId = await getActorId();
  if (!followerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const followingId = parseTargetId(body);
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

export async function DELETE(request: Request) {
  const followerId = await getActorId();
  if (!followerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const followingId = parseTargetId(body);
  if (!followingId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const state = await unfollowUser({ followerId, followingId });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    if (error instanceof Error && error.message === "Cannot follow yourself.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "User not found." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not unfollow user." }, { status: 500 });
  }
}
