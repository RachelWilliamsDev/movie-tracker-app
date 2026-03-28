"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const LIMIT = 20;
const POLL_MS = 30_000;

type FeedItem = {
  id: string;
  sentence: string;
  createdAt: string;
};

type Pagination = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  nextOffset: number | null;
};

export default function FeedPage() {
  const { status } = useSession();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async (cursor: string | null) => {
    const url = new URL("/api/activity/feed", window.location.origin);
    url.searchParams.set("limit", String(LIMIT));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      items?: Array<{ id: string; sentence?: string; createdAt: string }>;
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
        setItems(
          data.items!.map((i) => ({
            id: i.id,
            sentence: i.sentence ?? "",
            createdAt: i.createdAt
          }))
        );
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
      setItems((prev) => [
        ...prev,
        ...data.items!.map((i) => ({
          id: i.id,
          sentence: i.sentence ?? "",
          createdAt: i.createdAt
        }))
      ]);
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
        <h1 className="mt-4 text-2xl font-semibold">Friends activity</h1>
        <p className="mt-2 text-sm text-gray-600">
          Sign in to see activity from people you follow.
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
      <h1 className="text-2xl font-semibold">Friends activity</h1>

      {loadingInitial ? (
        <ul aria-busy="true" aria-label="Loading feed" className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={`sk-${i}`}
              className="min-h-[48px] animate-pulse rounded-lg bg-gray-100"
            />
          ))}
        </ul>
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
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
              No activity yet. Follow friends and check back after they watch or
              rate something.
            </p>
          ) : null}
          {items.length > 0 ? (
            <>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm leading-snug text-gray-900"
                  >
                    {item.sentence}
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
