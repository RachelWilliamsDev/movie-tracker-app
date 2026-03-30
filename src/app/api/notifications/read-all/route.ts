import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/notifications/read-all — MEM-111 mark all unread notifications as read.
 *
 * Idempotent:
 * - calling repeatedly after all are read returns 200 with updatedCount = 0
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  try {
    const result = await prisma.notification.updateMany({
      where: { userId: viewerId, isRead: false },
      data: { isRead: true }
    });

    return Response.json({ ok: true, updatedCount: result.count });
  } catch {
    return jsonApiError(
      500,
      "Could not update notifications.",
      "NOTIFICATIONS_UPDATE_FAILED"
    );
  }
}

