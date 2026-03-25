"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type SearchResult = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  releaseYear: string | null;
  posterPath: string | null;
};

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w185";

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/tmdb/search?q=${encodeURIComponent(trimmed)}`);
        const payload = (await response.json()) as { results?: SearchResult[]; error?: string };

        if (!response.ok) {
          setResults([]);
          setError(payload.error ?? "Search failed.");
          return;
        }

        setResults(payload.results ?? []);
      } catch {
        setResults([]);
        setError("Search failed.");
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const showEmpty = useMemo(
    () => query.trim().length > 0 && !isLoading && !error && results.length === 0,
    [error, isLoading, query, results.length]
  );

  return (
    <section className="w-full max-w-3xl rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold">Search shows and movies</h2>
      <input
        className="mt-3 w-full rounded border border-gray-300 px-3 py-2"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search titles..."
        type="text"
        value={query}
      />

      {isLoading ? <p className="mt-3 text-sm text-gray-600">Loading results...</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {showEmpty ? <p className="mt-3 text-sm text-gray-600">No results found.</p> : null}

      {results.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {results.map((item) => (
            <li
              className="flex items-center gap-3 rounded border border-gray-200 p-2"
              key={`${item.mediaType}-${item.id}`}
            >
              {item.posterPath ? (
                <Image
                  alt={item.title}
                  className="h-16 w-11 rounded object-cover"
                  height={64}
                  src={`${POSTER_BASE_URL}${item.posterPath}`}
                  unoptimized
                  width={44}
                />
              ) : (
                <div className="flex h-16 w-11 items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
                  N/A
                </div>
              )}
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-gray-600">
                  {item.releaseYear ?? "Unknown year"} · {item.mediaType.toUpperCase()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
