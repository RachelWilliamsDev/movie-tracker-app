import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { countFollowers, countFollowing, getFollowState } from "@/lib/follow-service";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId")?.trim() ?? "";
  if (!targetUserId) {
    return jsonApiError(400, "userId is required", "BAD_REQUEST");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, profileVisibility: true }
  });
  if (!targetUser) {
    return jsonApiError(404, "User not found.", "NOT_FOUND");
  }

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const isOwnProfile = viewerId === targetUserId;
  const profileVisibility = targetUser.profileVisibility;

  try {
    if (!viewerId) {
      const [followersCount, followingCount] = await Promise.all([
        countFollowers(targetUserId),
        countFollowing(targetUserId)
      ]);

      return NextResponse.json({
        ok: true,
        isFollowing: false,
        isOwnProfile: false,
        followersCount,
        followingCount,
        profileVisibility
      });
    }

    const followState = await getFollowState(viewerId, targetUserId);
    return NextResponse.json({
      ok: true,
      isFollowing: followState.isFollowing,
      isOwnProfile,
      followersCount: followState.followersCount,
      followingCount: followState.followingCount,
      profileVisibility
    });
  } catch {
    return jsonApiError(
      500,
      "Could not fetch follow state.",
      "FOLLOW_STATE_FAILED"
    );
  }
}
