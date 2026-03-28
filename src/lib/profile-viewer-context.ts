/**
 * FEAT-126 (MEM-64): single source for own-vs-other semantics driving
 * `ProfileHeaderFollow` (counts + follow UI) on `/profile` and `/profile/[userId]`.
 */
export function resolveProfileViewerContext(
  viewerId: string | null,
  targetUserId: string
) {
  const id = targetUserId.trim();
  const viewerSignedIn = viewerId != null;
  const isOwnProfile = viewerSignedIn && viewerId === id;
  const showFollowAction = viewerSignedIn && !isOwnProfile;
  return {
    normalizedTargetUserId: id,
    viewerSignedIn,
    isOwnProfile,
    showFollowAction
  };
}
