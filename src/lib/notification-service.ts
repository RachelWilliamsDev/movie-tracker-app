import { Prisma, type NotificationType } from "@prisma/client";

export type CreateNotificationInput = {
  userId: string;
  actorId: string;
  type: NotificationType;
  entityId: string;
};

export type CreateNotificationResult = {
  created: boolean;
  reason: "created" | "duplicate" | "self";
};

type NotificationDb = {
  notification: {
    create(args: {
      data: {
        userId: string;
        actorId: string;
        type: NotificationType;
        entityId: string;
      };
    }): Promise<{ id: string }>;
  };
};

async function getDb(db?: NotificationDb): Promise<NotificationDb> {
  if (db) {
    return db;
  }
  const { prisma } = await import("@/lib/prisma");
  return prisma as unknown as NotificationDb;
}

/**
 * MEM-106 central helper:
 * - skips self-notifications (actor == recipient)
 * - DB-enforced dedupe via unique key on (userId, actorId, type, entityId)
 * - duplicate attempts are idempotent (created=false, reason="duplicate")
 */
export async function createNotification(
  input: CreateNotificationInput,
  db?: NotificationDb
): Promise<CreateNotificationResult> {
  const { userId, actorId, type, entityId } = input;
  if (userId === actorId) {
    return { created: false, reason: "self" };
  }

  const resolvedDb = await getDb(db);

  try {
    await resolvedDb.notification.create({
      data: { userId, actorId, type, entityId }
    });
    return { created: true, reason: "created" };
  } catch (error) {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002") ||
      (typeof error === "object" &&
        error != null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002")
    ) {
      return { created: false, reason: "duplicate" };
    }
    throw error;
  }
}

/** Convention: LIKE entity is the post id. */
export async function notifyPostLiked(
  input: {
    recipientUserId: string;
    actorId: string;
    postId: string;
  },
  db?: NotificationDb
): Promise<CreateNotificationResult> {
  return createNotification(
    {
      userId: input.recipientUserId,
      actorId: input.actorId,
      type: "LIKE",
      entityId: input.postId
    },
    db
  );
}

/** Convention: COMMENT entity is the comment id (one notification per comment). */
export async function notifyPostCommented(
  input: {
    recipientUserId: string;
    actorId: string;
    commentId: string;
  },
  db?: NotificationDb
): Promise<CreateNotificationResult> {
  return createNotification(
    {
      userId: input.recipientUserId,
      actorId: input.actorId,
      type: "COMMENT",
      entityId: input.commentId
    },
    db
  );
}

/** Convention: FOLLOW entity is the actor id (recipient+actor pair uniqueness). */
export async function notifyUserFollowed(
  input: {
    followedUserId: string;
    actorId: string;
  },
  db?: NotificationDb
): Promise<CreateNotificationResult> {
  return createNotification(
    {
      userId: input.followedUserId,
      actorId: input.actorId,
      type: "FOLLOW",
      entityId: input.actorId
    },
    db
  );
}
