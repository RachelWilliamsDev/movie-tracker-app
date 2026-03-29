import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { parsePostCommentContent } from "@/lib/post-comment-content";
import { userSocialDisplayName } from "@/lib/user-search";

/**
 * GET /api/posts/[postId]/comments — MEM-88 list comments (flat thread).
 *
 * **Order:** oldest first (`createdAt` asc, `id` asc) so the FE can append in reading order.
 *
 * Query:
 * - `limit` — optional, default 50, max 100
 * - `cursor` — optional opaque token from `pagination.nextCursor` (keyset after last item)
 *
 * Auth: **not** required (read-only). Unknown `postId` → **404**.
 *
 * XSS: see `docs/post-comments-api.md`. Body text is plain UTF-8 in JSON; clients must treat as
 * text (e.g. React default text escaping), not HTML.
 *
 * POST /api/posts/[postId]/comments — create comment (session required).
 *
 * Body JSON: `{ "content": string }` — trimmed, 1…2000 chars (UTF-16 length, MVP).
 *
 * **401** if not signed in. **404** if post does not exist. **400** if validation fails.
 */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const commentUserSelect = {
  id: true,
  name: true,
  username: true
} as const;

type CursorPayload = { t: string; i: string };

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

export type PostCommentJson = {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  content: string;
  createdAt: string;
};

function mapCommentRow(row: {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  user: { name: string | null; username: string | null };
}): PostCommentJson {
  return {
    id: row.id,
    userId: row.userId,
    username: row.user.username,
    displayName: userSocialDisplayName(row.user),
    content: row.content,
    createdAt: row.createdAt.toISOString()
  };
}

type RouteCtx = { params: Promise<{ postId: string }> };

export async function GET(request: Request, context: RouteCtx) {
  const { postId } = await context.params;
  const id = postId?.trim() ?? "";
  if (!id) {
    return jsonApiError(404, "Post not found.", "NOT_FOUND");
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true }
  });
  if (!post) {
    return jsonApiError(404, "Post not found.", "NOT_FOUND");
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursorRaw = url.searchParams.get("cursor")?.trim() ?? "";

  let where: Prisma.PostCommentWhereInput = { postId: id };

  if (cursorRaw.length > 0) {
    const cur = decodeCursor(cursorRaw);
    if (!cur) {
      return jsonApiError(400, "Invalid cursor", "BAD_REQUEST");
    }
    const createdAt = new Date(cur.t);
    if (Number.isNaN(createdAt.getTime())) {
      return jsonApiError(400, "Invalid cursor", "BAD_REQUEST");
    }
    where = {
      AND: [
        { postId: id },
        {
          OR: [
            { createdAt: { gt: createdAt } },
            {
              AND: [{ createdAt }, { id: { gt: cur.i } }]
            }
          ]
        }
      ]
    };
  }

  try {
    const rows = await prisma.postComment.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      include: { user: { select: commentUserSelect } }
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last != null
        ? encodeCursor({ t: last.createdAt.toISOString(), i: last.id })
        : null;

    return NextResponse.json({
      ok: true,
      comments: page.map(mapCommentRow),
      pagination: {
        limit,
        hasMore,
        nextCursor,
        order: "oldest_first" as const
      }
    });
  } catch {
    return jsonApiError(
      500,
      "Could not load comments.",
      "COMMENTS_LIST_FAILED"
    );
  }
}

export async function POST(request: Request, context: RouteCtx) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  const { postId } = await context.params;
  const id = postId?.trim() ?? "";
  if (!id) {
    return jsonApiError(404, "Post not found.", "NOT_FOUND");
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true }
  });
  if (!post) {
    return jsonApiError(404, "Post not found.", "NOT_FOUND");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonApiError(400, "Invalid JSON", "BAD_REQUEST");
  }

  const record = body as { content?: unknown };
  const parsed = parsePostCommentContent(record?.content);
  if (!parsed.ok) {
    return jsonApiError(400, parsed.error, "BAD_REQUEST");
  }

  try {
    const created = await prisma.postComment.create({
      data: {
        postId: id,
        userId,
        content: parsed.content
      },
      include: {
        user: { select: commentUserSelect }
      }
    });

    return NextResponse.json({
      ok: true,
      comment: mapCommentRow(created)
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return jsonApiError(404, "Post not found.", "NOT_FOUND");
    }
    return jsonApiError(
      500,
      "Could not create comment.",
      "COMMENT_CREATE_FAILED"
    );
  }
}
