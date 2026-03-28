import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
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
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  const body = await parseBody(request);
  if (!body) {
    return jsonApiError(400, "Invalid JSON", "BAD_REQUEST");
  }

  const followingId = parseTargetId(body);
  if (!followingId) {
    return jsonApiError(400, "userId is required", "BAD_REQUEST");
  }

  try {
    const state = await followUser({ followerId, followingId });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    if (error instanceof Error && error.message === "Cannot follow yourself.") {
      return jsonApiError(400, error.message, "BAD_REQUEST");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return jsonApiError(404, "User not found.", "NOT_FOUND");
    }
    return jsonApiError(500, "Could not follow user.", "FOLLOW_FAILED");
  }
}

export async function DELETE(request: Request) {
  const followerId = await getActorId();
  if (!followerId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  const body = await parseBody(request);
  if (!body) {
    return jsonApiError(400, "Invalid JSON", "BAD_REQUEST");
  }

  const followingId = parseTargetId(body);
  if (!followingId) {
    return jsonApiError(400, "userId is required", "BAD_REQUEST");
  }

  try {
    const state = await unfollowUser({ followerId, followingId });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    if (error instanceof Error && error.message === "Cannot follow yourself.") {
      return jsonApiError(400, error.message, "BAD_REQUEST");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return jsonApiError(404, "User not found.", "NOT_FOUND");
    }
    return jsonApiError(500, "Could not unfollow user.", "UNFOLLOW_FAILED");
  }
}
