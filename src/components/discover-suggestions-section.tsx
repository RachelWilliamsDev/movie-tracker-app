"use client";

/**
 * FEAT-123 (MEM-61): suggested users above search on Discover — client fetch to
 * GET /api/users/suggestions (FEAT-122). Same row UX as search (`DiscoverUserRow`).
 */

import { useEffect, useState } from "react";
import { DiscoverUserRow } from "@/components/discover-user-row";
import { Button } from "@/components/ui/button";
import {
  USER_SUGGESTIONS_DEFAULT_LIMIT,
  type PublicUserSearchHit
} from "@/lib/user-search";

export function DiscoverSuggestionsSection({ viewerId }: { viewerId: string }) {
  const [suggested, setSuggested] = useState<PublicUserSearchHit[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [suggestedError, setSuggestedError] = useState<string | null>(null);
  const [suggestedRetryNonce, setSuggestedRetryNonce] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setSuggestedLoading(true);
    setSuggestedError(null);

    const url = new URL("/api/users/suggestions", window.location.origin);
    url.searchParams.set("limit", String(USER_SUGGESTIONS_DEFAULT_LIMIT));

    fetch(url.toString(), { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          code?: string;
          users?: PublicUserSearchHit[];
        };
        if (res.status === 401 || data.code === "UNAUTHORIZED") {
          throw new Error("UNAUTHORIZED");
        }
        if (!res.ok || !data.ok || !Array.isArray(data.users)) {
          throw new Error(
            data.error ?? "Could not load suggestions. Try again."
          );
        }
        setSuggested(data.users);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          setSuggestedError("UNAUTHORIZED");
          setSuggested([]);
          return;
        }
        setSuggested([]);
        setSuggestedError(
          e instanceof Error ? e.message : "Something went wrong."
        );
      })
      .finally(() => {
        if (!ac.signal.aborted) {
          setSuggestedLoading(false);
        }
      });

    return () => ac.abort();
  }, [viewerId, suggestedRetryNonce]);

  return (
    <>
      {suggestedLoading ? (
        <p aria-live="polite" className="mt-6 text-sm text-gray-600">
          Loading suggestions…
        </p>
      ) : null}

      {suggestedError && suggestedError !== "UNAUTHORIZED" ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{suggestedError}</p>
          <Button
            className="mt-3"
            onClick={() => {
              setSuggestedError(null);
              setSuggestedRetryNonce((n) => n + 1);
            }}
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {!suggestedLoading && !suggestedError && suggested.length > 0 ? (
        <section
          aria-labelledby="discover-suggested-heading"
          className="mt-6"
        >
          <h2
            className="text-base font-semibold text-gray-900"
            id="discover-suggested-heading"
          >
            Suggested for you
          </h2>
          <ul className="mt-3 list-none space-y-2 p-0" role="list">
            {suggested.map((u) => (
              <DiscoverUserRow key={u.userId} hit={u} viewerId={viewerId} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
