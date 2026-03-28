/**
 * Pure helpers for follow/unfollow UX: optimistic counts, stale responses, dedupe.
 */

export function optimisticFollowersCount(
  wasFollowing: boolean,
  nextFollowing: boolean,
  followersCount: number
): number {
  if (nextFollowing === wasFollowing) {
    return followersCount;
  }
  if (nextFollowing) {
    return followersCount + 1;
  }
  return Math.max(0, followersCount - 1);
}

/** Only apply a fetch result if it matches the latest started request for this target. */
export function isStaleFollowResponse(
  requestId: number,
  latestRequestId: number
): boolean {
  return requestId !== latestRequestId;
}

const inFlightTargets = new Set<string>();

/**
 * Prevents overlapping toggles for the same target across hook instances (best-effort).
 */
export function tryBeginFollowToggle(targetUserId: string): boolean {
  if (inFlightTargets.has(targetUserId)) {
    return false;
  }
  inFlightTargets.add(targetUserId);
  return true;
}

export function endFollowToggle(targetUserId: string): void {
  inFlightTargets.delete(targetUserId);
}
