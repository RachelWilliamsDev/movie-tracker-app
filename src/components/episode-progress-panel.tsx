"use client";

import { useState } from "react";

type Episode = {
  episodeNumber: number;
  title: string;
};

type Props = {
  contentId: number;
  isLoggedIn: boolean;
  episodes: Episode[];
  seasonNumber: number;
  savedEpisodeNumber: number | null;
};

export function EpisodeProgressPanel({
  contentId,
  isLoggedIn,
  episodes,
  seasonNumber,
  savedEpisodeNumber
}: Props) {
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(savedEpisodeNumber);
  const [loadingEpisodeNumber, setLoadingEpisodeNumber] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function setEpisode(episodeNumber: number) {
    setLoadingEpisodeNumber(episodeNumber);
    setError("");

    try {
      const res = await fetch("/api/episode-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          mediaType: "tv",
          seasonNumber,
          episodeNumber
        }),
        credentials: "same-origin"
      });

      const payload = (await res.json()) as { error?: string; ok?: boolean };

      if (res.status === 401) {
        setError("Session expired. Sign in again.");
        return;
      }

      if (!res.ok) {
        setError(payload.error ?? "Could not save progress.");
        return;
      }

      setSelectedEpisode(episodeNumber);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoadingEpisodeNumber(null);
    }
  }

  const effectiveSelected = selectedEpisode ?? savedEpisodeNumber ?? null;

  if (!isLoggedIn) {
    return (
      <p className="mt-4 text-sm text-gray-600">Sign in to track episode progress.</p>
    );
  }

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-gray-500">Episode progress</h2>
      <p className="mt-1 text-sm text-gray-600">
        Current episode: {effectiveSelected ? `Episode ${effectiveSelected}` : "Not set"}
      </p>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <ul className="mt-3 space-y-2">
        {episodes.map((ep) => {
          const isSelected = effectiveSelected === ep.episodeNumber;
          const isLoading = loadingEpisodeNumber === ep.episodeNumber;

          return (
            <li key={ep.episodeNumber}>
              <button
                className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                  isSelected ? "border-black bg-black/5" : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
                disabled={isLoading}
                type="button"
                onClick={() => setEpisode(ep.episodeNumber)}
              >
                <span className="font-medium">Episode {ep.episodeNumber}</span>
                <span className="ml-2 text-gray-600">· {ep.title || "Untitled"}</span>
                {isLoading ? <span className="ml-2 text-gray-500">(saving…)</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

