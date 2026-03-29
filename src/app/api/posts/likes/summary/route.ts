import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import {
  POST_LIKE_SUMMARY_MAX_IDS,
  summarizePostLikesForViewer
} from "@/lib/post-like-service";

/**
 * POST /api/posts/likes/summary — MEM-87 batch like counts + `viewerHasLiked` (feed hydration, no N+1).
 *
 * Body JSON: `{ "postIds": string[] }` — deduped; at most **50** ids processed (extras ignored).
 * Unknown ids are omitted from the response (only existing `Post` rows are returned).
 *
 * Auth: **required** (401) so `viewerHasLiked` is defined.
 *
 * Success 200:
 * ```json
 * { "ok": true, "posts": { "<postId>": { "likeCount": 0, "viewerHasLiked": false } } }
 * ```
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonApiError(400, "Invalid JSON", "BAD_REQUEST");
  }

  const raw = body as { postIds?: unknown };
  if (!Array.isArray(raw.postIds)) {
    return jsonApiError(400, "postIds array is required", "BAD_REQUEST");
  }

  const postIds = raw.postIds
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const uniqueIds = [...new Set(postIds)];
  if (uniqueIds.length > POST_LIKE_SUMMARY_MAX_IDS) {
    return jsonApiError(
      400,
      `At most ${POST_LIKE_SUMMARY_MAX_IDS} distinct post ids allowed`,
      "BAD_REQUEST"
    );
  }

  try {
    const map = await summarizePostLikesForViewer(viewerId, uniqueIds);
    const posts: Record<string, { likeCount: number; viewerHasLiked: boolean }> =
      {};
    for (const [pid, v] of map) {
      posts[pid] = {
        likeCount: v.likeCount,
        viewerHasLiked: v.viewerHasLiked
      };
    }
    return NextResponse.json({ ok: true, posts });
  } catch {
    return jsonApiError(
      500,
      "Could not load like summary.",
      "LIKES_SUMMARY_FAILED"
    );
  }
}
