"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { DiscoverUserRow } from "@/components/discover-user-row";
import { Button } from "@/components/ui/button";
import type { PublicUserSearchHit } from "@/lib/user-search";

const DEBOUNCE_MS = 350;
const LIMIT = 20;

export default function DiscoverPage() {
  const { data: session, status } = useSession();
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [users, setUsers] = useState<PublicUserSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) {
      setDebouncedQuery("");
      return;
    }
    const id = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [inputValue]);

  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setUsers([]);
      setError(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);

    const url = new URL("/api/users/search", window.location.origin);
    url.searchParams.set("q", debouncedQuery);
    url.searchParams.set("limit", String(LIMIT));

    fetch(url.toString(), { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          users?: PublicUserSearchHit[];
        };
        if (res.status === 401) {
          throw new Error("UNAUTHORIZED");
        }
        if (!res.ok || !data.ok || !Array.isArray(data.users)) {
          throw new Error(data.error ?? "Search failed.");
        }
        setUsers(data.users);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          setError("UNAUTHORIZED");
          setUsers([]);
          return;
        }
        setUsers([]);
        setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => {
        if (!ac.signal.aborted) {
          setLoading(false);
        }
      });

    return () => ac.abort();
  }, [debouncedQuery, retryNonce]);

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-gray-600">Loading…</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900">Discover users</h1>
        <p className="mt-2 text-sm text-gray-600">
          Sign in to search for other members.
        </p>
        <Button asChild className="mt-4" type="button" variant="default">
          <Link href="/">Back to home</Link>
        </Button>
      </main>
    );
  }

  const trimmedInput = inputValue.trim();
  const idle =
    trimmedInput.length === 0 &&
    !loading &&
    !error &&
    users.length === 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
        Discover users
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Search by display name or email.
      </p>

      <label className="mt-6 block">
        <span className="sr-only">Search users</span>
        <input
          aria-busy={loading}
          autoComplete="off"
          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 sm:text-sm"
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search by name or email…"
          type="search"
          value={inputValue}
        />
      </label>

      {loading ? (
        <p
          aria-live="polite"
          className="mt-4 text-sm text-gray-600"
        >
          Searching…
        </p>
      ) : null}

      {error && error !== "UNAUTHORIZED" ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          <Button
            className="mt-3"
            onClick={() => {
              setError(null);
              setRetryNonce((n) => n + 1);
            }}
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {error === "UNAUTHORIZED" ? (
        <p className="mt-4 text-sm text-gray-600">
          Your session expired.{" "}
          <Link className="font-medium underline" href="/">
            Sign in again
          </Link>
          .
        </p>
      ) : null}

      {idle ? (
        <p className="mt-6 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
          Search by name or email to find people you know.
        </p>
      ) : null}

      {!idle && !loading && debouncedQuery.length > 0 && !error && users.length === 0 ? (
        <p className="mt-6 text-sm text-gray-600">No users match that search.</p>
      ) : null}

      {users.length > 0 && session?.user?.id ? (
        <ul className="mt-6 list-none space-y-2 p-0" role="list">
          {users.map((u) => (
            <DiscoverUserRow
              key={u.userId}
              hit={u}
              viewerId={session.user.id}
            />
          ))}
        </ul>
      ) : null}
    </main>
  );
}
