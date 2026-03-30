import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { profilePathForUser, userSocialDisplayName } from "@/lib/user-search";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type CursorPayload = { t: string; i: string };

/**
 * GET /api/notifications — MEM-110 paginated notification list for signed-in user.
 *
 * Query:
 * - `limit` (optional, default 20, max 50)
 * - `cursor` (optional): opaque keyset token from `pagination.nextCursor`
 *
 * Success 200:
 * - `items[]` newest-first
 * - `unreadCount` for header badge
 * - `pagination: { limit, hasMore, nextCursor }`
 *
 * Privacy:
 * - Includes actor `id`, `username`, `displayName` (no email).
 */

function parseLimit(raw: string | null): number {
  if (raw == null || raw === "") return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(raw: string): CursorPayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const v = JSON.parse(json) as unknown;
    if (
      v != null &&
      typeof v === "object" &&
      "t" in v &&
      "i" in v &&
      typeof (v as CursorPayload).t === "string" &&
      typeof (v as CursorPayload).i === "string"
    ) {
      return v as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursorRaw = url.searchParams.get("cursor")?.trim() ?? "";

  let cursorWhere:
    | {
        OR: Array<
          | { createdAt: { lt: Date } }
          | { AND: [{ createdAt: Date }, { id: { lt: string } }] }
        >;
      }
    | undefined;
  if (cursorRaw) {
    const cur = decodeCursor(cursorRaw);
    if (!cur) {
      return jsonApiError(400, "Invalid cursor", "BAD_REQUEST");
    }
    const createdAt = new Date(cur.t);
    if (Number.isNaN(createdAt.getTime())) {
      return jsonApiError(400, "Invalid cursor", "BAD_REQUEST");
    }
    cursorWhere = {
      OR: [
        { createdAt: { lt: createdAt } },
        { AND: [{ createdAt }, { id: { lt: cur.i } }] }
      ]
    };
  }

  try {
    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: viewerId, ...(cursorWhere ?? {}) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        include: {
          actor: { select: { id: true, username: true, name: true } }
        }
      }),
      prisma.notification.count({
        where: { userId: viewerId, isRead: false }
      })
    ]);

    const commentIds = rows
      .filter((n) => n.type === "COMMENT")
      .map((n) => n.entityId);
    const postIdsFromLike = rows
      .filter((n) => n.type === "LIKE")
      .map((n) => n.entityId);

    const [comments, postsFromLike] = await Promise.all([
      commentIds.length > 0
        ? prisma.postComment.findMany({
            where: { id: { in: [...new Set(commentIds)] } },
            select: { id: true, postId: true, content: true }
          })
        : [],
      postIdsFromLike.length > 0
        ? prisma.post.findMany({
            where: { id: { in: [...new Set(postIdsFromLike)] } },
            select: { id: true, content: true }
          })
        : []
    ]);

    const commentById = new Map(comments.map((c) => [c.id, c]));
    const postById = new Map(postsFromLike.map((p) => [p.id, p]));

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ t: last.createdAt.toISOString(), i: last.id })
        : null;

    const items = page.map((n) => {
      const actorDisplayName = userSocialDisplayName(n.actor);
      let entity: {
        kind: "POST" | "FOLLOW";
        postId?: string | null;
        commentId?: string | null;
        preview?: string | null;
        href: string | null;
      };

      if (n.type === "FOLLOW") {
        entity = {
          kind: "FOLLOW",
          href: profilePathForUser(n.actor.id, n.actor.username)
        };
      } else if (n.type === "COMMENT") {
        const c = commentById.get(n.entityId);
        entity = {
          kind: "POST",
          postId: c?.postId ?? null,
          commentId: n.entityId,
          preview: c?.content ?? null,
          href: c?.postId ? "/feed" : null
        };
      } else {
        const p = postById.get(n.entityId);
        entity = {
          kind: "POST",
          postId: n.entityId,
          preview: p?.content ?? null,
          href: "/feed"
        };
      }

      return {
        id: n.id,
        type: n.type,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
        actor: {
          id: n.actor.id,
          username: n.actor.username,
          displayName: actorDisplayName
        },
        entity
      };
    });

    return Response.json({
      ok: true,
      items,
      unreadCount,
      pagination: {
        limit,
        hasMore,
        nextCursor
      }
    });
  } catch {
    return jsonApiError(
      500,
      "Could not load notifications.",
      "NOTIFICATIONS_LIST_FAILED"
    );
  }
}

