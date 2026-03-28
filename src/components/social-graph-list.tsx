"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type SocialGraphItem = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  followedAt: string;
};

type Pagination = { limit: number; hasMore: boolean; nextCursor: string | null };

function initials(username: string): string {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[1]?.[0];
    const s = `${a ?? ""}${b ?? ""}`.toUpperCase();
    return s.length > 0 ? s : "?";
  }
  const u = parts[0] ?? "?";
  return u.slice(0, 2).toUpperCase();
}

function ListAvatar({ item }: { item: SocialGraphItem }) {
  if (item.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote user avatars; URLs vary
      <img
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        height={40}
        src={item.avatarUrl}
        width={40}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600"
    >
      {initials(item.username)}
    </div>
  );
}

type Props = {
  mode: "followers" | "following";
  targetUserId: string;
};

export function SocialGraphList({ mode, targetUserId }: Props) {
  const [items, setItems] = useState<SocialGraphItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const path =
        mode === "followers" ? "/api/follow/followers" : "/api/follow/following";
      const url = new URL(path, window.location.origin);
      url.searchParams.set("userId", targetUserId);
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        followers?: SocialGraphItem[];
        following?: SocialGraphItem[];
        pagination?: Pagination;
      };
      if (!res.ok || !data.ok || !data.pagination) {
        throw new Error(data.error ?? "Could not load list.");
      }
      const raw =
        mode === "followers" ? data.followers ?? [] : data.following ?? [];
      return { raw, pagination: data.pagination };
    },
    [mode, targetUserId]
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingInitial(true);
    setError(null);
    setItems([]);
    setNextCursor(null);
    setHasMore(false);

    fetchPage(null)
      .then(({ raw, pagination }) => {
        if (cancelled) return;
        setItems(raw);
        setNextCursor(pagination.nextCursor);
        setHasMore(pagination.hasMore);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchPage, targetUserId, mode]);

  async function loadMore() {
    if (!nextCursor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const { raw, pagination } = await fetchPage(nextCursor);
      setItems((prev) => [...prev, ...raw]);
      setNextCursor(pagination.nextCursor);
      setHasMore(pagination.hasMore);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingMore(false);
    }
  }

  const empty = !loadingInitial && items.length === 0;

  return (
    <div className="min-h-[280px]">
      {loadingInitial ? (
        <ul aria-busy="true" aria-label="Loading list" className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={`sk-${i}`}
              className="flex h-14 items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3"
            >
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 max-w-xs flex-1 animate-pulse rounded bg-gray-200" />
            </li>
          ))}
        </ul>
      ) : empty ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
          {mode === "followers"
            ? "No followers yet. When someone follows this profile, they will show up here."
            : "Not following anyone yet. Accounts you follow will appear here."}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={`${mode}-${item.userId}`}>
                <Link
                  className="flex min-h-[56px] items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 transition-colors hover:bg-gray-50"
                  href={`/profile/${encodeURIComponent(item.userId)}`}
                >
                  <ListAvatar item={item} />
                  <span className="font-medium text-gray-900">{item.username}</span>
                </Link>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <div className="mt-4">
              <Button
                disabled={loadingMore}
                onClick={() => void loadMore()}
                type="button"
                variant="outline"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
