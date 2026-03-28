"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useFollowAction } from "@/hooks/use-follow-action";
import type { PublicUserSearchHit } from "@/lib/user-search";

function rowInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[1]?.[0];
    const s = `${a ?? ""}${b ?? ""}`.toUpperCase();
    return s.length > 0 ? s : "?";
  }
  const u = parts[0] ?? "?";
  return u.slice(0, 2).toUpperCase();
}

function RowAvatar({ hit }: { hit: PublicUserSearchHit }) {
  if (hit.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote user avatars when present
      <img
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        height={40}
        src={hit.avatarUrl}
        width={40}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600"
    >
      {rowInitials(hit.displayName)}
    </div>
  );
}

export function DiscoverUserRow({
  hit,
  viewerId
}: {
  hit: PublicUserSearchHit;
  viewerId: string;
}) {
  const isSelf = hit.userId === viewerId;
  const profileHref = `/profile/${encodeURIComponent(hit.userId)}`;

  const {
    isFollowing,
    pending,
    error,
    successFeedback,
    toggleFollow
  } = useFollowAction({
    targetUserId: hit.userId,
    isOwnProfile: isSelf,
    initialFollowersCount: 0,
    initialFollowingCount: 0,
    initialIsFollowing: hit.isFollowing,
    enablePeriodicRefresh: false
  });

  return (
    <li className="list-none rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <Link
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          href={profileHref}
        >
          <RowAvatar hit={hit} />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-gray-900">{hit.displayName}</div>
            <div className="truncate text-sm text-gray-500">{hit.username}</div>
          </div>
        </Link>
        {!isSelf ? (
          <div className="flex shrink-0 flex-col justify-center gap-1 border-t border-gray-100 px-4 py-2 sm:border-t-0 sm:border-l sm:py-3">
            <Button
              aria-busy={pending}
              aria-label={
                isFollowing
                  ? `Unfollow ${hit.displayName}`
                  : `Follow ${hit.displayName}`
              }
              disabled={pending}
              onClick={() => void toggleFollow()}
              size="sm"
              type="button"
              variant={isFollowing ? "outline" : "default"}
            >
              {pending ? "Updating…" : isFollowing ? "Unfollow" : "Follow"}
            </Button>
            {error ? (
              <p className="max-w-[160px] text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            {successFeedback ? (
              <p className="max-w-[160px] text-xs text-green-700" role="status">
                {successFeedback}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
