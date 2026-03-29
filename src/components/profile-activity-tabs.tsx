"use client";

import type { WatchStatus } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FeedPostCard } from "@/components/feed-post-card";
import { Button } from "@/components/ui/button";
import type { UnifiedFeedPostItem } from "@/lib/unified-feed-post-mapper";

const LIMIT = 20;
const LIKE_SUMMARY_MAX_IDS = 50;

function viewerWatchKey(contentId: number, mediaType: "movie" | "tv"): string {
  return `${contentId}:${mediaType}`;
}

type Pagination = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  nextOffset: number | null;
};

type PostEngagement = { likeCount: number; viewerHasLiked: boolean };

async function fetchLikeSummaryChunks(
  postIds: string[]
): Promise<Record<string, PostEngagement>> {
  const unique = [...new Set(postIds)].filter(Boolean);
  const merged: Record<string, PostEngagement> = {};
  for (let i = 0; i < unique.length; i += LIKE_SUMMARY_MAX_IDS) {
    const chunk = unique.slice(i, i + LIKE_SUMMARY_MAX_IDS);
    const res = await fetch("/api/posts/likes/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ postIds: chunk })
    });
    const data = (await res.json()) as {
      ok?: boolean;
      posts?: Record<string, PostEngagement>;
    };
    if (res.ok && data.ok && data.posts) {
      Object.assign(merged, data.posts);
    }
  }
  return merged;
}

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
        </div>
      </div>
    </div>
  );
}

function ProfileRecentActivityPanel({ targetUserId }: { targetUserId: string }) {
  const { status, data: session } = useSession();
  const [items, setItems] = useState<UnifiedFeedPostItem[]>([]);
  const [engagement, setEngagement] = useState<Record<string, PostEngagement>>(
    {}
  );
  const [watchByKey, setWatchByKey] = useState<Record<string, WatchStatus>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydrateLikes = useCallback(async (postIds: string[]) => {
    if (postIds.length === 0 || status !== "authenticated") {
      return;
    }
    try {
      const posts = await fetchLikeSummaryChunks(postIds);
      if (Object.keys(posts).length > 0) {
        setEngagement((prev) => ({ ...prev, ...posts }));
      }
    } catch {
      /* ignore */
    }
  }, [status]);

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const url = new URL(
        `/api/users/${encodeURIComponent(targetUserId)}/posts`,
        window.location.origin
      );
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
      if (res.status === 403) {
        throw new Error("FORBIDDEN");
      }
      if (!res.ok || !data.ok || !data.pagination || !data.items) {
        throw new Error(data.error ?? "Could not load activity.");
      }
      return data;
    },
    [targetUserId]
  );

  const loadInitial = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);
    try {
      const data = await fetchPage(null);
      setItems(data.items!);
      setNextCursor(data.pagination!.nextCursor);
      setHasMore(data.pagination!.hasMore);
      void hydrateLikes(data.items!.map((p) => p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingInitial(false);
    }
  }, [fetchPage, hydrateLikes]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      setWatchByKey({});
      return;
    }
    if (items.length === 0) {
      setWatchByKey({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/watch?userId=${encodeURIComponent(session.user.id)}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as {
          ok?: boolean;
          watches?: Array<{
            contentId: number;
            mediaType: string;
            watchStatus: WatchStatus;
          }>;
        };
        if (cancelled) {
          return;
        }
        if (!res.ok || !data.ok || !Array.isArray(data.watches)) {
          return;
        }
        const next: Record<string, WatchStatus> = {};
        for (const w of data.watches) {
          if (w.mediaType !== "movie" && w.mediaType !== "tv") {
            continue;
          }
          next[viewerWatchKey(w.contentId, w.mediaType)] = w.watchStatus;
        }
        setWatchByKey(next);
      } catch {
        /* keep */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id, items]);

  async function loadMore() {
    if (!nextCursor || loadingMore || !hasMore) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchPage(nextCursor);
      setItems((prev) => [...prev, ...data.items!]);
      setNextCursor(data.pagination!.nextCursor);
      setHasMore(data.pagination!.hasMore);
      void hydrateLikes(data.items!.map((p) => p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (loadingInitial) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading recent activity"
        className="space-y-4"
        role="status"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <FeedCardSkeleton key={`sk-${i}`} />
        ))}
      </div>
    );
  }

  if (error === "FORBIDDEN") {
    return (
      <p className="text-sm text-gray-600">
        You can’t view this activity — this profile’s privacy settings hide it.
      </p>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        No shares or activity posts here yet.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {items.map((item) => {
          const e = engagement[item.id];
          const mediaType = item.media.kind === "MOVIE" ? "movie" : "tv";
          const wk = viewerWatchKey(item.media.tmdbId, mediaType);
          return (
            <li key={item.id}>
              <FeedPostCard
                item={item}
                likeCount={e?.likeCount ?? 0}
                viewerHasLiked={e?.viewerHasLiked ?? false}
                onLikeSynced={(postId, liked, count) => {
                  setEngagement((prev) => ({
                    ...prev,
                    [postId]: { likeCount: count, viewerHasLiked: liked }
                  }));
                }}
                viewerWatchStatus={watchByKey[wk] ?? null}
                onWatchUpdated={(contentId, mt, st) => {
                  setWatchByKey((prev) => ({
                    ...prev,
                    [viewerWatchKey(contentId, mt)]: st
                  }));
                }}
              />
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <Button
          className="mt-4"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          type="button"
          variant="outline"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </>
  );
}

export function ProfileActivityTabs({
  targetUserId,
  overview
}: {
  targetUserId: string;
  overview: ReactNode;
}) {
  const [tab, setTab] = useState<"overview" | "activity">("overview");

  return (
    <div className="space-y-4">
      <div
        className="flex gap-1 border-b border-gray-200"
        role="tablist"
        aria-label="Profile sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          className={`rounded-t-md px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 ${
            tab === "overview"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "activity"}
          className={`rounded-t-md px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 ${
            tab === "activity"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setTab("activity")}
        >
          Recent activity
        </button>
      </div>

      {tab === "overview" ? (
        <div role="tabpanel" className="space-y-4">
          {overview}
        </div>
      ) : (
        <div role="tabpanel" className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-base font-medium text-gray-900">Recent activity</h2>
          <p className="mt-1 text-sm text-gray-600">
            Shares and feed posts from this member.
          </p>
          <div className="mt-4">
            <ProfileRecentActivityPanel targetUserId={targetUserId} />
          </div>
        </div>
      )}
    </div>
  );
}
