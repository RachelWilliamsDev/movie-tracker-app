import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { togglePostLike } from "@/lib/post-like-service";

/**
 * POST /api/posts/[postId]/like — MEM-87 toggle like for the signed-in user.
 *
 * **Idempotent semantics:** Each call flips state (liked → unliked → liked). Repeating after a pause
 * is equivalent to explicit unlike + like. Duplicate rows are impossible (`@@unique([userId, postId])`).
 *
 * Success 200: `{ ok: true, liked: boolean, likeCount: number }`
 *
 * **401** unauthenticated. **404** unknown post.
 *
 * Concurrency: see `docs/post-likes-api.md`.
 */
type RouteCtx = { params: Promise<{ postId: string }> };

export async function POST(_request: Request, context: RouteCtx) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  const { postId } = await context.params;
  const id = postId?.trim() ?? "";

  try {
    const result = await togglePostLike(userId, id);
    if (result == null) {
      return jsonApiError(404, "Post not found.", "NOT_FOUND");
    }
    return NextResponse.json({
      ok: true,
      liked: result.liked,
      likeCount: result.likeCount
    });
  } catch {
    return jsonApiError(500, "Could not toggle like.", "LIKE_TOGGLE_FAILED");
  }
}
