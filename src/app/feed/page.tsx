"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { FeedPostCard } from "@/components/feed-post-card";
import { Button } from "@/components/ui/button";
import type { UnifiedFeedPostItem } from "@/lib/unified-feed-post-mapper";

const LIMIT = 20;
const POLL_MS = 30_000;

type Pagination = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  nextOffset: number | null;
};

function FeedCardSkeleton() {
  return (
    <div
      aria-hidden
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex gap-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
          <div className="mt-3 flex gap-3 rounded-md border border-gray-100 bg-gray-50/80 p-3">
            <div className="h-[4.5rem] w-12 shrink-0 animate-pulse rounded bg-gray-200" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
              <div className="h-4 max-w-[200px] w-[min(100%,12rem)] animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const { status } = useSession();
  const [items, setItems] = useState<UnifiedFeedPostItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async (cursor: string | null) => {
    const url = new URL("/api/feed/posts", window.location.origin);
    url.searchParams.set("limit", String(LIMIT));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      items?: UnifiedFeedPostItem[];
      pagination?: Pagination;
    };
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    if (!res.ok || !data.ok || !data.pagination || !data.items) {
      throw new Error(data.error ?? "Could not load feed.");
    }
    return data;
  }, []);

  const loadInitial = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) {
        setLoadingInitial(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const data = await fetchFeed(null);
        setItems(data.items!);
        setNextCursor(data.pagination!.nextCursor);
        setHasMore(data.pagination!.hasMore);
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          setError("UNAUTHORIZED");
        } else {
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      } finally {
        setLoadingInitial(false);
        setRefreshing(false);
      }
    },
    [fetchFeed]
  );

  useEffect(() => {
    if (status !== "authenticated") {
      setLoadingInitial(false);
      return;
    }
    void loadInitial();
  }, [status, loadInitial]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    const id = window.setInterval(() => {
      void loadInitial({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [status, loadInitial]);

  async function loadMore() {
    if (!nextCursor || loadingMore || !hasMore) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchFeed(nextCursor);
      setItems((prev) => [...prev, ...data.items!]);
      setNextCursor(data.pagination!.nextCursor);
      setHasMore(data.pagination!.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-sm text-gray-600">Loading…</p>
      </main>
    );
  }

  if (status !== "authenticated" || error === "UNAUTHORIZED") {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <Link className="text-sm text-gray-600 underline" href="/">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Feed</h1>
        <p className="mt-2 text-sm text-gray-600">
          Sign in to see posts from people you follow.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link className="text-sm text-gray-600 underline" href="/">
          ← Back
        </Link>
        {refreshing ? (
          <span className="text-xs text-gray-500">Updating…</span>
        ) : null}
      </div>
      <h1 className="text-2xl font-semibold">Feed</h1>
      <p className="text-sm text-gray-600">
        Activity and shares from people you follow.
      </p>

      {loadingInitial ? (
        <div
          aria-busy="true"
          aria-label="Loading feed"
          className="space-y-4"
          role="status"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <FeedCardSkeleton key={`sk-${i}`} />
          ))}
        </div>
      ) : (
        <>
          {error && error !== "UNAUTHORIZED" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p>{error}</p>
              <Button
                className="mt-3"
                onClick={() => void loadInitial()}
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : null}
          {!error && items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
              <p className="text-sm font-medium text-gray-800">Nothing here yet</p>
              <p className="mt-2 text-sm text-gray-600">
                Follow friends to see their watches, ratings, and shares in one
                place.
              </p>
            </div>
          ) : null}
          {items.length > 0 ? (
            <>
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id}>
                    <FeedPostCard item={item} />
                  </li>
                ))}
              </ul>
              {hasMore ? (
                <Button
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                  type="button"
                  variant="outline"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
