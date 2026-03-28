import { prisma } from "@/lib/prisma";
import { canViewUserActivityFromPolicy } from "@/lib/activity-visibility-policy";

export { canViewUserActivityFromPolicy } from "@/lib/activity-visibility-policy";

export type ActivityAccessResult = {
  targetExists: boolean;
  allowed: boolean;
};

export async function resolveUserActivityAccess(
  viewerId: string | null,
  targetUserId: string
): Promise<ActivityAccessResult> {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, profileVisibility: true }
  });
  if (!user) {
    return { targetExists: false, allowed: false };
  }

  if (viewerId != null && viewerId === targetUserId) {
    return { targetExists: true, allowed: true };
  }

  if (user.profileVisibility === "PUBLIC") {
    return { targetExists: true, allowed: true };
  }

  if (viewerId == null) {
    return { targetExists: true, allowed: false };
  }

  const follow = await prisma.userFollow.findUnique({
    where: {
      followerId_followingId: { followerId: viewerId, followingId: targetUserId }
    },
    select: { approvalStatus: true }
  });

  const allowed = canViewUserActivityFromPolicy({
    viewerId,
    targetUserId,
    profileVisibility: user.profileVisibility,
    followApprovalStatus: follow?.approvalStatus ?? null
  });

  return { targetExists: true, allowed };
}
