import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BATCH_MAX_IDS = 50;

export type TogglePostLikeResult = {
  liked: boolean;
  likeCount: number;
};

/**
 * MEM-87: Flip like state for (userId, postId). Idempotent outcome: repeated toggles alternate.
 * Duplicate like prevented by `@@unique([userId, postId])`; concurrent creates may hit P2002 — treated as liked.
 */
export async function togglePostLike(
  userId: string,
  postId: string
): Promise<TogglePostLikeResult | null> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true }
  });
  if (!post) {
    return null;
  }

  const existing = await prisma.postLike.findUnique({
    where: {
      userId_postId: { userId, postId }
    }
  });

  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
  } else {
    try {
      await prisma.postLike.create({
        data: { userId, postId }
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        /* concurrent like — row now exists */
      } else {
        throw e;
      }
    }
  }

  const likeCount = await prisma.postLike.count({ where: { postId } });
  const stillLiked = !!(await prisma.postLike.findUnique({
    where: { userId_postId: { userId, postId } }
  }));

  return { liked: stillLiked, likeCount };
}

export type PostLikeSummary = {
  likeCount: number;
  viewerHasLiked: boolean;
};

/**
 * Like counts + viewer flags for many posts in two queries (MEM-87, feed hydration).
 */
export async function summarizePostLikesForViewer(
  viewerId: string,
  postIds: string[]
): Promise<Map<string, PostLikeSummary>> {
  const unique = [...new Set(postIds)].filter((id) => id.length > 0);
  const slice = unique.slice(0, BATCH_MAX_IDS);
  if (slice.length === 0) {
    return new Map();
  }

  const existingPosts = await prisma.post.findMany({
    where: { id: { in: slice } },
    select: { id: true }
  });
  const validIds = new Set(existingPosts.map((p) => p.id));
  if (validIds.size === 0) {
    return new Map();
  }

  const validList = [...validIds];

  const [counts, viewerRows] = await Promise.all([
    prisma.postLike.groupBy({
      by: ["postId"],
      where: { postId: { in: validList } },
      _count: { id: true }
    }),
    prisma.postLike.findMany({
      where: { userId: viewerId, postId: { in: validList } },
      select: { postId: true }
    })
  ]);

  const countByPost = new Map<string, number>();
  for (const row of counts) {
    countByPost.set(row.postId, row._count.id);
  }

  const likedSet = new Set(viewerRows.map((r) => r.postId));

  const out = new Map<string, PostLikeSummary>();
  for (const id of validList) {
    out.set(id, {
      likeCount: countByPost.get(id) ?? 0,
      viewerHasLiked: likedSet.has(id)
    });
  }
  return out;
}

export { BATCH_MAX_IDS as POST_LIKE_SUMMARY_MAX_IDS };
