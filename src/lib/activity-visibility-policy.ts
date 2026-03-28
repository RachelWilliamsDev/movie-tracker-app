import type { FollowApprovalStatus, ProfileVisibility } from "@prisma/client";

/**
 * Whether `viewerId` may read another user's watch list, ratings, and episode progress.
 * Private profiles: only owner or an APPROVED follower (PENDING reserved for future approval UX).
 */
export function canViewUserActivityFromPolicy(input: {
  viewerId: string | null;
  targetUserId: string;
  profileVisibility: ProfileVisibility;
  followApprovalStatus: FollowApprovalStatus | null;
}): boolean {
  const { viewerId, targetUserId, profileVisibility, followApprovalStatus } = input;
  if (viewerId != null && viewerId === targetUserId) {
    return true;
  }
  if (profileVisibility === "PUBLIC") {
    return true;
  }
  if (viewerId == null) {
    return false;
  }
  return followApprovalStatus === "APPROVED";
}
