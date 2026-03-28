"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useFollowAction } from "@/hooks/use-follow-action";

type Props = {
  targetUserId: string;
  isOwnProfile: boolean;
  initialFollowersCount: number;
  initialFollowingCount: number;
  initialIsFollowing: boolean;
  displayName: string;
  memberLabel: string;
  /** When false (e.g. logged-out viewer), hide follow button and prompt to sign in. */
  showFollowAction?: boolean;
  /** When false, skip periodic follow-state refresh (e.g. logged-out viewer). Default true. */
  enablePeriodicRefresh?: boolean;
};

export function ProfileHeaderFollow({
  targetUserId,
  isOwnProfile,
  initialFollowersCount,
  initialFollowingCount,
  initialIsFollowing,
  displayName,
  memberLabel,
  showFollowAction = true,
  enablePeriodicRefresh = true
}: Props) {
  const {
    followersCount,
    followingCount,
    isFollowing,
    pending,
    error,
    successFeedback,
    toggleFollow
  } = useFollowAction({
    targetUserId,
    isOwnProfile,
    initialFollowersCount,
    initialFollowingCount,
    initialIsFollowing,
    enablePeriodicRefresh
  });

  return (
    <div>
      <p className="text-sm text-gray-500">{memberLabel}</p>
      <p className="mt-1 text-lg font-medium text-gray-900">{displayName}</p>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label="Followers and following"
      >
        <Button asChild size="sm" variant="outline">
          <Link
            href={`/profile/followers?userId=${encodeURIComponent(targetUserId)}`}
          >
            <span className="tabular-nums font-semibold text-gray-900">
              {followersCount}
            </span>
            <span className="text-gray-600"> followers</span>
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link
            href={`/profile/following?userId=${encodeURIComponent(targetUserId)}`}
          >
            <span className="tabular-nums font-semibold text-gray-900">
              {followingCount}
            </span>
            <span className="text-gray-600"> following</span>
          </Link>
        </Button>
      </div>
      {!isOwnProfile ? (
        <div className="mt-4">
          {showFollowAction ? (
            <Button
              aria-busy={pending}
              disabled={pending}
              onClick={() => void toggleFollow()}
              type="button"
              variant={isFollowing ? "outline" : "default"}
            >
              {pending ? "Updating…" : isFollowing ? "Unfollow" : "Follow"}
            </Button>
          ) : (
            <p className="text-sm text-gray-600">
              <Link className="font-medium underline" href="/">
                Sign in
              </Link>{" "}
              to follow this member.
            </p>
          )}
        </div>
      ) : null}
      {successFeedback ? (
        <p className="mt-2 text-sm text-green-700" role="status">
          {successFeedback}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
