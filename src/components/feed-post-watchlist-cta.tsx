"use client";

import type { WatchStatus } from "@prisma/client";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { WATCH_STATUS_LABEL } from "@/lib/watch-status";

type MediaType = "movie" | "tv";

type Props = {
  contentId: number;
  mediaType: MediaType;
  initialWatchStatus: WatchStatus | null;
  onWatchUpdated?: (
    contentId: number,
    mediaType: MediaType,
    status: WatchStatus
  ) => void;
};

export function FeedPostWatchlistCta({
  contentId,
  mediaType,
  initialWatchStatus,
  onWatchUpdated
}: Props) {
  const { status } = useSession();
  const authed = status === "authenticated";

  const [watchStatus, setWatchStatus] = useState<WatchStatus | null>(
    initialWatchStatus
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWatchStatus(initialWatchStatus);
  }, [contentId, mediaType, initialWatchStatus]);

  async function addToWatchlist() {
    if (!authed || pending || watchStatus != null) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          contentId,
          mediaType,
          watchStatus: "WANT_TO_WATCH",
          watchSource: null
        })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        watchStatus?: WatchStatus;
      };

      if (res.status === 401) {
        setError("Sign in again to update your watchlist.");
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not add to watchlist.");
        return;
      }

      const next =
        typeof data.watchStatus === "string"
          ? (data.watchStatus as WatchStatus)
          : "WANT_TO_WATCH";
      setWatchStatus(next);
      onWatchUpdated?.(contentId, mediaType, next);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (!authed) {
    return (
      <p className="mt-2 text-xs text-gray-500">
        <Link className="underline" href="/">
          Sign in on the home page
        </Link>{" "}
        to add titles to your watchlist.
      </p>
    );
  }

  if (watchStatus != null) {
    return (
      <div className="mt-2">
        <Button
          aria-label={`In your list: ${WATCH_STATUS_LABEL[watchStatus]}`}
          className="text-gray-600"
          disabled
          type="button"
          variant="outline"
        >
          Added · {WATCH_STATUS_LABEL[watchStatus]}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <Button
        disabled={pending}
        onClick={() => void addToWatchlist()}
        type="button"
        variant="outline"
      >
        {pending ? "Adding…" : "Add to watchlist"}
      </Button>
      {error ? (
        <p className="mt-1.5 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
