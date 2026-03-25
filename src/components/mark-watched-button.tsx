"use client";

import type { WatchSource } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WATCH_SOURCE_LABEL, WATCH_SOURCE_ORDER } from "@/lib/watch-source";

type Props = {
  contentId: number;
  mediaType: "movie" | "tv";
  initialWatched: boolean;
  initialWatchSource: WatchSource | null;
  isLoggedIn: boolean;
};

export function MarkWatchedButton({
  contentId,
  mediaType,
  initialWatched,
  initialWatchSource,
  isLoggedIn
}: Props) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatched);
  const [watchSource, setWatchSource] = useState<WatchSource | null>(initialWatchSource);
  const [loadingSource, setLoadingSource] = useState<WatchSource | null>(null);
  const [message, setMessage] = useState("");

  async function saveWithSource(source: WatchSource) {
    setLoadingSource(source);
    setMessage("");
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, mediaType, watchSource: source }),
        credentials: "same-origin"
      });
      const data = (await res.json()) as {
        error?: string;
        ok?: boolean;
        watchSource?: WatchSource;
      };

      if (res.status === 401) {
        setMessage("Session expired. Sign in again.");
        return;
      }
      if (!res.ok) {
        setMessage(data.error ?? "Could not save.");
        return;
      }

      setWatched(true);
      setWatchSource(data.watchSource ?? source);
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoadingSource(null);
    }
  }

  if (!isLoggedIn) {
    return (
      <p className="mt-4 text-sm text-gray-600">
        Sign in on the home page to mark titles as watched.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <h2 className="text-sm font-medium text-gray-500">Where did you watch it?</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {WATCH_SOURCE_ORDER.map((source) => {
          const loading = loadingSource === source;
          const active = watchSource === source && watched;
          return (
            <button
              key={source}
              className={`rounded border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                active
                  ? "border-black bg-black text-white"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              }`}
              disabled={loading}
              onClick={() => saveWithSource(source)}
              type="button"
            >
              {loading ? "…" : WATCH_SOURCE_LABEL[source]}
            </button>
          );
        })}
      </div>

      {watched ? (
        <p className="mt-3 text-sm font-medium text-green-800">
          {watchSource != null
            ? `Watched on ${WATCH_SOURCE_LABEL[watchSource]}`
            : "Marked as watched"}
        </p>
      ) : (
        <p className="mt-2 text-xs text-gray-500">Choose a source to save your watch.</p>
      )}

      {message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
