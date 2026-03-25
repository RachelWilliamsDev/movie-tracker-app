"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  contentId: number;
  mediaType: "movie" | "tv";
  initialWatched: boolean;
  isLoggedIn: boolean;
};

export function MarkWatchedButton({
  contentId,
  mediaType,
  initialWatched,
  isLoggedIn
}: Props) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatched);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (!isLoggedIn) {
    return (
      <p className="mt-4 text-sm text-gray-600">
        Sign in on the home page to mark titles as watched.
      </p>
    );
  }

  if (watched) {
    return (
      <p className="mt-4 text-sm font-medium text-green-800">Marked as watched</p>
    );
  }

  const handleClick = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, mediaType }),
        credentials: "same-origin"
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };

      if (res.status === 401) {
        setMessage("Session expired. Sign in again.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setMessage(data.error ?? "Could not save.");
        setLoading(false);
        return;
      }

      setWatched(true);
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        disabled={loading}
        onClick={handleClick}
        type="button"
      >
        {loading ? "Saving…" : "Mark as Watched"}
      </button>
      {message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
