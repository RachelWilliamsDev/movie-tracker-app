"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type FollowStatePayload = {
  ok?: boolean;
  isFollowing?: boolean;
  followersCount?: number;
  followingCount?: number;
  error?: string;
};

type Props = {
  targetUserId: string;
  isOwnProfile: boolean;
  initialFollowersCount: number;
  initialFollowingCount: number;
  initialIsFollowing: boolean;
  displayName: string;
  memberLabel: string;
};

const POLL_MS = 45_000;

export function ProfileHeaderFollow({
  targetUserId,
  isOwnProfile,
  initialFollowersCount,
  initialFollowingCount,
  initialIsFollowing,
  displayName,
  memberLabel
}: Props) {
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [followingCount, setFollowingCount] = useState(initialFollowingCount);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFollowersCount(initialFollowersCount);
    setFollowingCount(initialFollowingCount);
    setIsFollowing(initialIsFollowing);
    setError(null);
  }, [
    targetUserId,
    initialFollowersCount,
    initialFollowingCount,
    initialIsFollowing
  ]);

  const refreshFromServer = useCallback(async () => {
    const res = await fetch(
      `/api/follow/state?userId=${encodeURIComponent(targetUserId)}`,
      { cache: "no-store" }
    );
    const data = (await res.json()) as FollowStatePayload;
    if (!res.ok || !data.ok) {
      return;
    }
    if (typeof data.followersCount === "number") {
      setFollowersCount(data.followersCount);
    }
    if (typeof data.followingCount === "number") {
      setFollowingCount(data.followingCount);
    }
    if (!isOwnProfile && typeof data.isFollowing === "boolean") {
      setIsFollowing(data.isFollowing);
    }
  }, [targetUserId, isOwnProfile]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshFromServer();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshFromServer]);

  async function toggleFollow() {
    if (isOwnProfile || pending) {
      return;
    }
    setError(null);
    const snapshot = { followersCount, isFollowing };
    const nextFollowing = !isFollowing;
    setPending(true);
    setIsFollowing(nextFollowing);
    setFollowersCount((c) => Math.max(0, nextFollowing ? c + 1 : c - 1));

    try {
      const res = await fetch("/api/follow", {
        method: nextFollowing ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId })
      });
      const data = (await res.json()) as FollowStatePayload & {
        viewerId?: string;
        targetUserId?: string;
      };

      if (!res.ok || !data.ok) {
        setFollowersCount(snapshot.followersCount);
        setIsFollowing(snapshot.isFollowing);
        setError(data.error ?? "Could not update follow.");
        return;
      }

      if (typeof data.followersCount === "number") {
        setFollowersCount(data.followersCount);
      }
      if (typeof data.followingCount === "number") {
        setFollowingCount(data.followingCount);
      }
      if (typeof data.isFollowing === "boolean") {
        setIsFollowing(data.isFollowing);
      }
    } catch {
      setFollowersCount(snapshot.followersCount);
      setIsFollowing(snapshot.isFollowing);
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

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
          <Button
            disabled={pending}
            onClick={() => void toggleFollow()}
            type="button"
            variant={isFollowing ? "outline" : "default"}
          >
            {pending ? "…" : isFollowing ? "Unfollow" : "Follow"}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
