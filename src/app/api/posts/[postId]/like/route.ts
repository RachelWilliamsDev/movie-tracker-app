import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { notifyPostLiked } from "@/lib/notification-service";
import { togglePostLike } from "@/lib/post-like-service";
import { prisma } from "@/lib/prisma";

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
    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, userId: true }
    });
    if (!post) {
      return jsonApiError(404, "Post not found.", "NOT_FOUND");
    }

    const result = await togglePostLike(userId, id);
    if (result == null) {
      return jsonApiError(404, "Post not found.", "NOT_FOUND");
    }

    // MEM-107: emit LIKE notifications only on the "liked" edge.
    // We do not delete historical notifications on unlike in MVP.
    if (result.liked) {
      await notifyPostLiked({
        recipientUserId: post.userId,
        actorId: userId,
        postId: post.id
      });
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
