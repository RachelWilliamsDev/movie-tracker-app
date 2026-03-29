"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Heart, MessageCircle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { Button } from "@/components/ui/button";
import { POST_COMMENT_MAX_LENGTH } from "@/lib/post-comment-content";
import { profilePathForUser } from "@/lib/user-search";

type CommentRow = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  content: string;
  createdAt: string;
};

function formatCommentTime(iso: string): { relative: string; absolute: string } {
  const d = new Date(iso);
  const absolute = Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short"
      });
  const now = Date.now();
  const t = d.getTime();
  if (Number.isNaN(t)) {
    return { relative: iso, absolute };
  }
  const sec = Math.round((now - t) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (sec < 60) {
    return { relative: rtf.format(-sec, "second"), absolute };
  }
  const min = Math.round(sec / 60);
  if (min < 60) {
    return { relative: rtf.format(-min, "minute"), absolute };
  }
  const hr = Math.round(min / 60);
  if (hr < 48) {
    return { relative: rtf.format(-hr, "hour"), absolute };
  }
  const day = Math.round(hr / 24);
  return { relative: rtf.format(-day, "day"), absolute };
}

type Props = {
  postId: string;
  likeCount: number;
  viewerHasLiked: boolean;
  onLikeSynced?: (
    postId: string,
    liked: boolean,
    likeCount: number
  ) => void;
};

export function FeedPostSocial({
  postId,
  likeCount: initialLikeCount,
  viewerHasLiked: initialViewerHasLiked,
  onLikeSynced
}: Props) {
  const { status } = useSession();
  const authed = status === "authenticated";

  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [viewerHasLiked, setViewerHasLiked] = useState(initialViewerHasLiked);
  const [likePending, setLikePending] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentPending, setCommentPending] = useState(false);
  const [commentFormError, setCommentFormError] = useState<string | null>(null);

  const commentsRef = useRef<HTMLDivElement>(null);
  const commentFieldId = useId();

  useEffect(() => {
    setLikeCount(initialLikeCount);
    setViewerHasLiked(initialViewerHasLiked);
  }, [postId, initialLikeCount, initialViewerHasLiked]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        cache: "no-store"
      });
      const data = (await res.json()) as {
        ok?: boolean;
        comments?: CommentRow[];
        error?: string;
      };
      if (!res.ok || !data.ok || !Array.isArray(data.comments)) {
        setCommentsError(data.error ?? "Could not load comments.");
        setComments([]);
        return;
      }
      setComments(data.comments);
    } catch {
      setCommentsError("Could not load comments.");
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (commentsOpen && comments === null && !commentsLoading) {
      void loadComments();
    }
  }, [commentsOpen, comments, commentsLoading, loadComments]);

  useLayoutEffect(() => {
    if (commentsOpen) {
      commentsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
  }, [commentsOpen]);

  async function toggleLike() {
    if (!authed || likePending) {
      return;
    }
    const prevLiked = viewerHasLiked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    setViewerHasLiked(nextLiked);
    setLikeCount(nextCount);
    setLikePending(true);
    setLikeError(null);

    try {
      const res = await fetch(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        {
          method: "POST",
          credentials: "same-origin"
        }
      );
      let data: {
        ok?: boolean;
        liked?: boolean;
        likeCount?: number;
        error?: string;
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }

      if (!res.ok || !data.ok) {
        setViewerHasLiked(prevLiked);
        setLikeCount(prevCount);
        setLikeError(data.error ?? "Could not update like.");
        return;
      }

      const liked = Boolean(data.liked);
      const count =
        typeof data.likeCount === "number" ? data.likeCount : nextCount;
      setViewerHasLiked(liked);
      setLikeCount(count);
      onLikeSynced?.(postId, liked, count);
    } catch {
      setViewerHasLiked(prevLiked);
      setLikeCount(prevCount);
      setLikeError("Could not update like.");
    } finally {
      setLikePending(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!authed || commentPending) {
      return;
    }
    const trimmed = commentDraft.trim();
    if (trimmed.length === 0) {
      setCommentFormError("Write something first.");
      return;
    }
    if (trimmed.length > POST_COMMENT_MAX_LENGTH) {
      setCommentFormError(
        `Comment must be at most ${POST_COMMENT_MAX_LENGTH} characters.`
      );
      return;
    }

    setCommentPending(true);
    setCommentFormError(null);

    try {
      const res = await fetch(
        `/api/posts/${encodeURIComponent(postId)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ content: trimmed })
        }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        comment?: CommentRow;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.comment) {
        setCommentFormError(data.error ?? "Could not post comment.");
        return;
      }

      setCommentDraft("");
      setComments((prev) => [...(prev ?? []), data.comment!]);
    } catch {
      setCommentFormError("Could not post comment.");
    } finally {
      setCommentPending(false);
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-label={viewerHasLiked ? "Unlike" : "Like"}
          aria-pressed={viewerHasLiked}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!authed || likePending}
          onClick={() => void toggleLike()}
          type="button"
        >
          <Heart
            aria-hidden
            className={
              viewerHasLiked
                ? "size-4 fill-red-500 text-red-500"
                : "size-4 text-gray-600"
            }
          />
          <span>{likeCount}</span>
        </button>

        <button
          aria-expanded={commentsOpen}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          onClick={() => setCommentsOpen((o) => !o)}
          type="button"
        >
          <MessageCircle aria-hidden className="size-4 text-gray-600" />
          Comment
        </button>
      </div>

      {!authed ? (
        <p className="mt-2 text-xs text-gray-500">
          <Link className="underline" href="/">
            Sign in on the home page
          </Link>{" "}
          to like or comment.
        </p>
      ) : null}

      {likeError ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {likeError}
        </p>
      ) : null}

      {commentsOpen ? (
        <div
          className="mt-3 rounded-md border border-gray-100 bg-gray-50/50 p-3"
          ref={commentsRef}
        >
          {commentsLoading ? (
            <p className="text-sm text-gray-600" role="status">
              Loading comments…
            </p>
          ) : null}

          {commentsError && !commentsLoading ? (
            <p className="text-sm text-red-600" role="alert">
              {commentsError}
            </p>
          ) : null}

          {!commentsLoading &&
          !commentsError &&
          comments &&
          comments.length === 0 ? (
            <p className="text-sm text-gray-600">No comments yet.</p>
          ) : null}

          {!commentsLoading && comments && comments.length > 0 ? (
            <ul className="space-y-3">
              {comments.map((c) => {
                const { relative, absolute } = formatCommentTime(c.createdAt);
                const profileHref = profilePathForUser(c.userId, c.username);
                return (
                  <li key={c.id}>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                      <Link
                        className="font-medium text-gray-900 underline-offset-2 hover:underline"
                        href={profileHref}
                      >
                        {c.displayName}
                      </Link>
                      {c.username &&
                      c.displayName.trim().toLowerCase() !==
                        c.username.toLowerCase() ? (
                        <span className="text-gray-500">@{c.username}</span>
                      ) : null}
                      <time
                        className="text-xs text-gray-500"
                        dateTime={c.createdAt}
                        title={absolute}
                      >
                        {relative}
                      </time>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">
                      {c.content}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {authed ? (
            <form
              className="mt-4 border-t border-gray-200 pt-3"
              onSubmit={(e) => void submitComment(e)}
            >
              <label
                className="mb-1.5 block text-sm font-medium text-gray-700"
                htmlFor={commentFieldId}
              >
                Add a comment
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                disabled={commentPending}
                id={commentFieldId}
                maxLength={POST_COMMENT_MAX_LENGTH}
                onChange={(ev) => setCommentDraft(ev.target.value)}
                placeholder="Write a comment…"
                rows={3}
                value={commentDraft}
              />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-500">
                  {commentDraft.trim().length}/{POST_COMMENT_MAX_LENGTH}
                </span>
                <Button disabled={commentPending} size="sm" type="submit">
                  {commentPending ? "Posting…" : "Post"}
                </Button>
              </div>
              {commentFormError ? (
                <p className="mt-2 text-xs text-red-600" role="alert">
                  {commentFormError}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
