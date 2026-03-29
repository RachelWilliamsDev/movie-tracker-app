"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { Dialog } from "radix-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { SHARE_POST_CONTENT_MAX } from "@/lib/share-post-payload";
import { cn } from "@/lib/utils";

type Props = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  isLoggedIn: boolean;
  /** When true, rating control is hidden (matches POST /api/posts/share rules). */
  hasExistingRating: boolean;
};

function messageForShareError(
  code: string | undefined,
  serverMessage: string
): string {
  switch (code) {
    case "SHARE_POST_ALREADY_RATED":
      return "You already rated this title. Share without a rating, or update your rating from this page first.";
    case "SHARE_POST_THROTTLED":
      return "You’re sharing a bit too fast. Try again in a little while.";
    case "SHARE_POST_INVALID_MEDIA":
      return "Something was wrong with this title. Refresh the page and try again.";
    case "UNAUTHORIZED":
      return "Your session expired. Sign in again.";
    case "SHARE_POST_FAILED":
      return "Could not post to your feed. Try again.";
    case "BAD_REQUEST":
      return serverMessage || "Invalid request.";
    default:
      return serverMessage || "Something went wrong.";
  }
}

export function ShareToFeedModal({
  tmdbId,
  mediaType,
  title,
  isLoggedIn,
  hasExistingRating
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const commentId = useId();
  const ratingGroupId = useId();

  const resetForm = useCallback(() => {
    setComment("");
    setRating(null);
    setError(null);
    setSuccess(false);
    setPending(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) {
      return;
    }

    const trimmed = comment.trim();
    if (trimmed.length > SHARE_POST_CONTENT_MAX) {
      setError(`Comment must be at most ${SHARE_POST_CONTENT_MAX} characters.`);
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(false);

    const mediaKind = mediaType === "movie" ? "MOVIE" : "TV";
    const body: Record<string, unknown> = {
      mediaKind,
      tmdbId,
      ...(trimmed.length > 0 ? { content: trimmed } : {})
    };
    if (!hasExistingRating && rating != null) {
      body.rating = rating;
    }

    try {
      const res = await fetch("/api/posts/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body)
      });

      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
      };

      if (res.status === 201 && payload.ok) {
        setSuccess(true);
        setComment("");
        setRating(null);
        router.refresh();
        return;
      }

      setError(
        messageForShareError(payload.code, payload.error ?? "Request failed.")
      );
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <p className="mt-4 text-sm text-gray-600">
        Sign in on the home page to share this title to your feed.
      </p>
    );
  }

  return (
    <section className="mt-4">
      <h2 className="text-sm font-medium text-gray-500">Share</h2>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          className={cn(buttonVariants({ variant: "outline" }), "mt-2")}
          type="button"
        >
          Share to feed
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content
            aria-busy={pending}
            className={cn(
              "fixed top-1/2 left-1/2 z-50 w-[min(100vw-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg",
              "focus:outline-none"
            )}
          >
            <Dialog.Title className="text-lg font-semibold">
              Share to feed
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              Share “{title}” with people who follow you. Add an optional note
              {hasExistingRating ? "" : " and rating"}.
            </Dialog.Description>

            {success ? (
              <div
                className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900"
                role="status"
              >
                <p>Posted to your feed.</p>
                <Link
                  className="mt-2 inline-block font-medium text-green-800 underline underline-offset-2"
                  href="/feed"
                >
                  View feed
                </Link>
                <div className="mt-4">
                  <Dialog.Close
                    className={cn(buttonVariants({ variant: "outline" }))}
                    type="button"
                  >
                    Close
                  </Dialog.Close>
                </div>
              </div>
            ) : (
              <form className="mt-4 space-y-4" onSubmit={(e) => void submit(e)}>
                <div>
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor={commentId}
                  >
                    Comment{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    disabled={pending}
                    id={commentId}
                    maxLength={SHARE_POST_CONTENT_MAX}
                    onChange={(ev) => setComment(ev.target.value)}
                    placeholder="Say something about this title…"
                    rows={4}
                    value={comment}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {comment.trim().length}/{SHARE_POST_CONTENT_MAX} characters
                  </p>
                </div>

                {hasExistingRating ? (
                  <p className="text-sm text-muted-foreground">
                    You’ve already rated this title. Your share can include a
                    comment only.
                  </p>
                ) : (
                  <fieldset className="space-y-2" disabled={pending}>
                    <legend
                      className="text-sm font-medium text-foreground"
                      id={ratingGroupId}
                    >
                      Rating{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </legend>
                    <div
                      aria-labelledby={ratingGroupId}
                      className="flex flex-wrap gap-2"
                      role="group"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          aria-pressed={rating === n}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                            rating === n
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:bg-muted"
                          )}
                          onClick={() =>
                            setRating((r) => (r === n ? null : n))
                          }
                          type="button"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <Dialog.Close
                    className={cn(buttonVariants({ variant: "outline" }))}
                    type="button"
                  >
                    Cancel
                  </Dialog.Close>
                  <Button disabled={pending} type="submit">
                    {pending ? "Posting…" : "Post to feed"}
                  </Button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
