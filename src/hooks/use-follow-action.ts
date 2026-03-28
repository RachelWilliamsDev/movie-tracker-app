"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  endFollowToggle,
  isStaleFollowResponse,
  optimisticFollowersCount,
  tryBeginFollowToggle
} from "@/lib/follow-action-guards";

type FollowStatePayload = {
  ok?: boolean;
  isFollowing?: boolean;
  followersCount?: number;
  followingCount?: number;
  error?: string;
};

export type UseFollowActionOptions = {
  targetUserId: string;
  isOwnProfile: boolean;
  initialFollowersCount: number;
  initialFollowingCount: number;
  initialIsFollowing: boolean;
};

const POLL_MS = 45_000;
const SUCCESS_CLEAR_MS = 3500;

export function useFollowAction({
  targetUserId,
  isOwnProfile,
  initialFollowersCount,
  initialFollowingCount,
  initialIsFollowing
}: UseFollowActionOptions) {
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [followingCount, setFollowingCount] = useState(initialFollowingCount);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const successClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (successClearRef.current) {
        clearTimeout(successClearRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setFollowersCount(initialFollowersCount);
    setFollowingCount(initialFollowingCount);
    setIsFollowing(initialIsFollowing);
    setError(null);
    setSuccessFeedback(null);
  }, [
    targetUserId,
    initialFollowersCount,
    initialFollowingCount,
    initialIsFollowing
  ]);

  const clearSuccessLater = useCallback(() => {
    if (successClearRef.current) {
      clearTimeout(successClearRef.current);
    }
    successClearRef.current = setTimeout(() => {
      setSuccessFeedback(null);
      successClearRef.current = null;
    }, SUCCESS_CLEAR_MS);
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    const res = await fetch(
      `/api/follow/state?userId=${encodeURIComponent(targetUserId)}`,
      { cache: "no-store" }
    );
    const data = (await res.json()) as FollowStatePayload;
    if (inFlightRef.current || !aliveRef.current) {
      return;
    }
    if (!res.ok || !data.ok) {
      return;
    }
    if (!aliveRef.current) {
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

  const toggleFollow = useCallback(async () => {
    if (isOwnProfile) {
      return;
    }
    if (inFlightRef.current) {
      return;
    }
    if (!tryBeginFollowToggle(targetUserId)) {
      return;
    }

    inFlightRef.current = true;
    setPending(true);
    setError(null);
    setSuccessFeedback(null);

    const requestId = ++requestIdRef.current;
    const snapshot = { followersCount, isFollowing };
    const nextFollowing = !isFollowing;

    setIsFollowing(nextFollowing);
    setFollowersCount((c) =>
      optimisticFollowersCount(snapshot.isFollowing, nextFollowing, c)
    );

    try {
      const res = await fetch("/api/follow", {
        method: nextFollowing ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId })
      });
      const data = (await res.json()) as FollowStatePayload;

      if (!aliveRef.current) {
        return;
      }

      if (isStaleFollowResponse(requestId, requestIdRef.current)) {
        return;
      }

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

      setSuccessFeedback(
        data.isFollowing ? "You are now following this profile." : "Unfollowed."
      );
      clearSuccessLater();
    } catch {
      if (
        aliveRef.current &&
        !isStaleFollowResponse(requestId, requestIdRef.current)
      ) {
        setFollowersCount(snapshot.followersCount);
        setIsFollowing(snapshot.isFollowing);
        setError("Network error. Try again.");
      }
    } finally {
      endFollowToggle(targetUserId);
      inFlightRef.current = false;
      if (aliveRef.current) {
        setPending(false);
      }
    }
  }, [
    isOwnProfile,
    targetUserId,
    followersCount,
    isFollowing,
    clearSuccessLater
  ]);

  return {
    followersCount,
    followingCount,
    isFollowing,
    pending,
    error,
    successFeedback,
    toggleFollow,
    refreshFromServer
  };
}
