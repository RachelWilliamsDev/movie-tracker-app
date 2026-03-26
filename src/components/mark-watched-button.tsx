"use client";

import type { WatchSource, WatchStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { WATCH_SOURCE_LABEL, WATCH_SOURCE_ORDER } from "@/lib/watch-source";
import { WATCH_STATUS_LABEL, WATCH_STATUS_ORDER } from "@/lib/watch-status";

type Props = {
  contentId: number;
  mediaType: "movie" | "tv";
  initialWatchStatus: WatchStatus | null;
  initialWatchSource: WatchSource | null;
  isLoggedIn: boolean;
};

export function MarkWatchedButton({
  contentId,
  mediaType,
  initialWatchStatus,
  initialWatchSource,
  isLoggedIn
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<WatchStatus | null>(initialWatchStatus);
  const [watchSource, setWatchSource] = useState<WatchSource | null>(initialWatchSource);
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState<WatchSource | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setStatus(initialWatchStatus);
    setWatchSource(initialWatchSource);
  }, [initialWatchStatus, initialWatchSource]);

  async function postWatch(nextStatus: WatchStatus, source: WatchSource | null) {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          mediaType,
          watchStatus: nextStatus,
          watchSource: source
        }),
        credentials: "same-origin"
      });
      const data = (await res.json()) as {
        error?: string;
        ok?: boolean;
        watchSource?: WatchSource | null;
        watchStatus?: WatchStatus;
      };

      if (res.status === 401) {
        setMessage("Session expired. Sign in again.");
        return;
      }
      if (!res.ok) {
        setMessage(data.error ?? "Could not save.");
        return;
      }

      if (typeof data.watchStatus === "string") {
        setStatus(data.watchStatus as WatchStatus);
      }
      setWatchSource(data.watchSource ?? null);
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCompletedSource(source: WatchSource) {
    setLoadingSource(source);
    setMessage("");
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          mediaType,
          watchStatus: "COMPLETED",
          watchSource: source
        }),
        credentials: "same-origin"
      });
      const data = (await res.json()) as {
        error?: string;
        ok?: boolean;
        watchSource?: WatchSource | null;
        watchStatus?: WatchStatus;
      };

      if (res.status === 401) {
        setMessage("Session expired. Sign in again.");
        return;
      }
      if (!res.ok) {
        setMessage(data.error ?? "Could not save.");
        return;
      }

      setStatus("COMPLETED");
      setWatchSource(data.watchSource ?? source);
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoadingSource(null);
    }
  }

  function onStatusChange(value: string) {
    const next = value as WatchStatus;
    setStatus(next);

    if (next === "COMPLETED") {
      return;
    }

    void postWatch(next, null);
  }

  if (!isLoggedIn) {
    return (
      <p className="mt-4 text-sm text-gray-600">
        Sign in on the home page to set your watch status.
      </p>
    );
  }

  const needsCompletedSource =
    status === "COMPLETED" && watchSource == null;

  const statusSummary =
    status != null ? (
      <p className="mt-3 text-sm text-gray-700">
        <span className="font-medium text-gray-900">Status:</span>{" "}
        {WATCH_STATUS_LABEL[status]}
        {status === "COMPLETED" && watchSource != null ? (
          <>
            {" "}
            · {WATCH_SOURCE_LABEL[watchSource]}
          </>
        ) : null}
      </p>
    ) : null;

  return (
    <div className="mt-4">
      <h2 className="text-sm font-medium text-gray-500">Watch status</h2>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          disabled={loading || loadingSource != null}
          onValueChange={onStatusChange}
          value={status ?? undefined}
        >
          <SelectTrigger className="w-full max-w-xs border-gray-200 bg-white text-gray-900">
            <SelectValue placeholder="Choose status" />
          </SelectTrigger>
          <SelectContent>
            {WATCH_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {WATCH_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsCompletedSource ? (
        <div className="mt-3">
          <p className="text-sm text-gray-600">Where did you finish it?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WATCH_SOURCE_ORDER.map((source) => {
              const busy = loadingSource === source;
              return (
                <button
                  key={source}
                  className="rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:opacity-50"
                  disabled={busy || loading}
                  onClick={() => saveCompletedSource(source)}
                  type="button"
                >
                  {busy ? "…" : WATCH_SOURCE_LABEL[source]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {statusSummary}

      {message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
