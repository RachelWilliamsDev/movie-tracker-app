"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  contentId: number;
  mediaType: "movie" | "tv";
  initialRating: number | null;
  isLoggedIn: boolean;
};

const MIN = 1;
const MAX = 5;

export function RatingPanel({ contentId, mediaType, initialRating, isLoggedIn }: Props) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(initialRating);
  const [loadingValue, setLoadingValue] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function submit(nextRating: number) {
    setLoadingValue(nextRating);
    setError("");
    try {
      const res = await fetch("/api/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, mediaType, rating: nextRating }),
        credentials: "same-origin"
      });

      const payload = (await res.json()) as { error?: string; ok?: boolean; rating?: number };

      if (res.status === 401) {
        setError("Session expired. Sign in again.");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Could not save rating.");
        return;
      }

      setRating(typeof payload.rating === "number" ? payload.rating : nextRating);
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoadingValue(null);
    }
  }

  if (!isLoggedIn) {
    return (
      <p className="mt-4 text-sm text-gray-600">Sign in on the home page to rate this title.</p>
    );
  }

  return (
    <section className="mt-4">
      <h2 className="text-sm font-medium text-gray-500">Your rating</h2>
      <p className="mt-1 text-sm text-gray-800">
        {rating != null ? (
          <>
            <span className="font-medium">{rating}</span> / {MAX}
          </>
        ) : (
          <span className="text-gray-600">Not rated yet</span>
        )}
      </p>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i).map((value) => {
          const active = rating === value;
          const loading = loadingValue === value;
          return (
            <button
              key={value}
              type="button"
              disabled={loading}
              className={`min-w-[2.5rem] rounded border px-2 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                active
                  ? "border-black bg-black text-white"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              }`}
              onClick={() => submit(value)}
            >
              {loading ? "…" : value}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-gray-500">Click a number to set or change your rating ({MIN}–{MAX}).</p>
    </section>
  );
}
