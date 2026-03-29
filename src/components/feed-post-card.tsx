"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PostMediaKind, PostType } from "@prisma/client";
import type { UnifiedFeedPostItem } from "@/lib/unified-feed-post-mapper";
import { profilePathForUser } from "@/lib/user-search";
import { WATCH_SOURCE_LABEL } from "@/lib/watch-source";
import type { WatchSource } from "@prisma/client";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

const WATCH_STATUS_LABEL: Record<string, string> = {
  WATCHING: "Watching",
  COMPLETED: "Completed",
  WANT_TO_WATCH: "Want to watch"
};

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

function formatFeedTimestamp(iso: string): { relative: string; absolute: string } {
  const d = new Date(iso);
  const absolute = Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      });

  const now = Date.now();
  const t = d.getTime();
  if (Number.isNaN(t)) {
    return { relative: iso, absolute };
  }

  const sec = Math.round((now - t) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (sec < 60) {
    return { relative: rtf.format(-sec, "second"), absolute };
  }
  const min = Math.round(sec / 60);
  if (min < 60) {
    return { relative: rtf.format(-min, "minute"), absolute };
  }
  const hr = Math.round(min / 60);
  if (hr < 48) {
    return { relative: rtf.format(-hr, "hour"), absolute };
  }
  const day = Math.round(hr / 24);
  if (day < 30) {
    return { relative: rtf.format(-day, "day"), absolute };
  }
  const month = Math.round(day / 30);
  if (month < 12) {
    return { relative: rtf.format(-month, "month"), absolute };
  }
  const year = Math.round(month / 12);
  return { relative: rtf.format(-year, "year"), absolute };
}

function asRecord(meta: unknown): Record<string, unknown> {
  return meta != null && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

function MetadataBadges({
  postType,
  metadata
}: {
  postType: PostType;
  metadata: unknown;
}) {
  const meta = asRecord(metadata);
  const pills: { key: string; label: string }[] = [];

  if (postType === "ACTIVITY") {
    const at = meta.activityType;
    if (at === "WATCH_COMPLETED") {
      pills.push({ key: "act", label: "Watched" });
      const src = meta.watchSource;
      if (typeof src === "string" && src in WATCH_SOURCE_LABEL) {
        pills.push({
          key: "src",
          label: WATCH_SOURCE_LABEL[src as WatchSource]
        });
      }
    } else if (at === "RATED") {
      pills.push({ key: "rated", label: "Rated" });
      const r = meta.rating;
      const n = typeof r === "number" ? r : Number(r);
      if (Number.isInteger(n) && n >= 1 && n <= 5) {
        pills.push({ key: "stars", label: `${n}/5` });
      }
    }
  }

  if (postType === "SHARE") {
    pills.push({ key: "share", label: "Shared" });
    const r = meta.rating;
    const n = typeof r === "number" ? r : Number(r);
    if (Number.isInteger(n) && n >= 1 && n <= 5) {
      pills.push({ key: "rating", label: `${n}/5` });
    }
    const ws = meta.watchStatus;
    if (typeof ws === "string" && WATCH_STATUS_LABEL[ws]) {
      pills.push({ key: "ws", label: WATCH_STATUS_LABEL[ws] });
    }
  }

  if (pills.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {pills.map((p) => (
        <span
          key={p.key}
          className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
        >
          {p.label}
        </span>
      ))}
    </div>
  );
}

type CardState =
  | { status: "loading" }
  | { status: "ok"; title: string; posterPath: string | null }
  | { status: "error" };

export function FeedPostCard({ item }: { item: UnifiedFeedPostItem }) {
  const { relative, absolute } = formatFeedTimestamp(item.createdAt);
  const authorHref = profilePathForUser(item.author.id, item.author.username);
  const showHandle =
    item.author.username &&
    item.author.displayName.trim().toLowerCase() !==
      item.author.username.toLowerCase();

  const [media, setMedia] = useState<CardState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const kind = item.media.kind as PostMediaKind;
    const tmdbId = item.media.tmdbId;

    async function run() {
      setMedia({ status: "loading" });
      const url = new URL("/api/tmdb/card", window.location.origin);
      url.searchParams.set("kind", kind);
      url.searchParams.set("tmdbId", String(tmdbId));
      try {
        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          title?: string;
          posterPath?: string | null;
        };
        if (cancelled) {
          return;
        }
        if (!res.ok || !data.ok || typeof data.title !== "string") {
          setMedia({ status: "error" });
          return;
        }
        setMedia({
          status: "ok",
          title: data.title,
          posterPath:
            typeof data.posterPath === "string" || data.posterPath === null
              ? data.posterPath
              : null
        });
      } catch {
        if (!cancelled) {
          setMedia({ status: "error" });
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [item.media.kind, item.media.tmdbId]);

  const mediaAriaLabel =
    media.status === "ok"
      ? `View details for ${media.title} (${item.media.kind === "MOVIE" ? "movie" : "TV show"})`
      : `View ${item.media.kind === "MOVIE" ? "movie" : "TV show"} details`;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600"
        >
          {rowInitials(item.author.displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              className="font-medium text-gray-900 underline-offset-2 hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
              href={authorHref}
            >
              {item.author.displayName}
            </Link>
            {showHandle ? (
              <span className="text-sm text-gray-500">
                @{item.author.username}
              </span>
            ) : null}
            <time
              className="text-sm text-gray-500"
              dateTime={item.createdAt}
              title={absolute}
            >
              {relative}
            </time>
          </div>

          <MetadataBadges metadata={item.metadata} postType={item.type} />

          {item.content ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
              {item.content}
            </p>
          ) : null}

          <div className="mt-3">
            <Link
              aria-label={mediaAriaLabel}
              className="flex gap-3 rounded-md border border-gray-100 bg-gray-50/80 p-3 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
              href={item.media.detailPath}
            >
              <div className="relative h-[4.5rem] w-12 shrink-0 overflow-hidden rounded bg-gray-200">
                {media.status === "ok" && media.posterPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- TMDB CDN; small card thumbs
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    height={72}
                    src={`${POSTER_BASE}${media.posterPath}`}
                    width={48}
                  />
                ) : media.status === "loading" ? (
                  <div
                    aria-hidden
                    className="h-full w-full animate-pulse bg-gray-200"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-full w-full items-center justify-center text-[10px] text-gray-500"
                  >
                    ?
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {item.media.kind === "MOVIE" ? "Movie" : "TV"}
                </p>
                <p className="truncate font-medium text-gray-900">
                  {media.status === "ok" ? (
                    media.title
                  ) : media.status === "loading" ? (
                    <span className="inline-block h-4 w-40 animate-pulse rounded bg-gray-200" />
                  ) : (
                    "Title unavailable"
                  )}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
