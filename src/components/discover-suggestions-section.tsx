"use client";

/**
 * FEAT-123 (MEM-61): suggested users above search on Discover — client fetch to
 * GET /api/users/suggestions (FEAT-122). Same row UX as search (`DiscoverUserRow`).
 * FEAT-125: loading skeletons, empty panel, shared error pattern with search.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { DiscoverUserRow } from "@/components/discover-user-row";
import {
  DiscoverErrorPanel,
  DiscoverMutedPanel,
  DiscoverUserRowSkeletonList
} from "@/components/discover-ux";
import {
  USER_SUGGESTIONS_DEFAULT_LIMIT,
  type PublicUserSearchHit
} from "@/lib/user-search";

const SUGGESTIONS_SKELETON_ROWS = 4;

export function DiscoverSuggestionsSection({ viewerId }: { viewerId: string }) {
  const [suggested, setSuggested] = useState<PublicUserSearchHit[]>([]);
  /** Start true to avoid a flash of the empty state before the first fetch runs. */
  const [suggestedLoading, setSuggestedLoading] = useState(true);
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
    <section aria-labelledby="discover-suggested-heading" className="mt-6">
      <h2
        className="text-base font-semibold text-gray-900"
        id="discover-suggested-heading"
      >
        Suggested for you
      </h2>

      {suggestedLoading ? (
        <DiscoverUserRowSkeletonList
          ariaLabel="Loading suggested people"
          className="mt-3"
          count={SUGGESTIONS_SKELETON_ROWS}
        />
      ) : null}

      {!suggestedLoading &&
      suggestedError &&
      suggestedError !== "UNAUTHORIZED" ? (
        <DiscoverErrorPanel
          className="mt-3"
          message={suggestedError}
          onRetry={() => {
            setSuggestedError(null);
            setSuggestedRetryNonce((n) => n + 1);
          }}
        />
      ) : null}

      {!suggestedLoading && suggestedError === "UNAUTHORIZED" ? (
        <p className="mt-3 text-sm text-gray-600">
          Your session expired.{" "}
          <Link className="font-medium underline" href="/">
            Sign in again
          </Link>
          .
        </p>
      ) : null}

      {!suggestedLoading && !suggestedError && suggested.length > 0 ? (
        <ul className="mt-3 list-none space-y-2 p-0" role="list">
          {suggested.map((u) => (
            <DiscoverUserRow key={u.userId} hit={u} viewerId={viewerId} />
          ))}
        </ul>
      ) : null}

      {!suggestedLoading && !suggestedError && suggested.length === 0 ? (
        <DiscoverMutedPanel className="mt-3">
          No suggestions right now. Search by name or email above to find people.
        </DiscoverMutedPanel>
      ) : null}
    </section>
  );
}
