import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { countFollowers, countFollowing, getFollowState } from "@/lib/follow-service";
import { prisma } from "@/lib/prisma";

type ProfileVisibility = "PUBLIC";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId")?.trim() ?? "";
  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true }
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const isOwnProfile = viewerId === targetUserId;
  const profileVisibility: ProfileVisibility = "PUBLIC";

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
    return NextResponse.json({ error: "Could not fetch follow state." }, { status: 500 });
  }
}
