import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/notifications/[id] — MEM-111 mark one notification as read.
 *
 * Ownership:
 * - only the signed-in recipient may update
 * - returns 404 when notification does not exist OR belongs to another user
 *
 * Idempotent:
 * - marking an already-read row returns 200 with unchanged state
 */
export async function PATCH(_request: Request, context: RouteCtx) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  const { id: raw } = await context.params;
  const id = raw?.trim() ?? "";
  if (!id) {
    return jsonApiError(404, "Notification not found.", "NOT_FOUND");
  }

  try {
    const existing = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, isRead: true, type: true, createdAt: true }
    });
    if (!existing || existing.userId !== viewerId) {
      return jsonApiError(404, "Notification not found.", "NOT_FOUND");
    }

    const row = existing.isRead
      ? existing
      : await prisma.notification.update({
          where: { id },
          data: { isRead: true },
          select: { id: true, isRead: true, type: true, createdAt: true }
        });

    return Response.json({
      ok: true,
      notification: {
        id: row.id,
        type: row.type,
        isRead: row.isRead,
        createdAt: row.createdAt.toISOString()
      }
    });
  } catch {
    return jsonApiError(
      500,
      "Could not update notification.",
      "NOTIFICATIONS_UPDATE_FAILED"
    );
  }
}

