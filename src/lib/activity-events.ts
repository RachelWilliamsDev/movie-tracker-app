import { after } from "next/server";
import type { ActivityEventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Queue a user activity row after the HTTP response is sent.
 * Failures are logged only; core mutations must not depend on this.
 */
export function scheduleUserActivityEvent(
  actorId: string,
  type: ActivityEventType,
  metadata: Prisma.InputJsonValue
): void {
  after(async () => {
    try {
      await prisma.userActivityEvent.create({
        data: {
          actorId,
          type,
          metadata
        }
      });
    } catch (error) {
      console.error("[UserActivityEvent] best-effort write failed:", error);
    }
  });
}
