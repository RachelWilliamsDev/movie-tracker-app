import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, type NotificationType } from "@prisma/client";
import {
  createNotification,
  notifyPostCommented,
  notifyPostLiked,
  notifyUserFollowed
} from "@/lib/notification-service";

type NotificationRow = {
  id: string;
  userId: string;
  actorId: string;
  type: NotificationType;
  entityId: string;
};

function createMockDb(seed: NotificationRow[] = []) {
  let rows = [...seed];

  return {
    notification: {
      async create(args: {
        data: {
          userId: string;
          actorId: string;
          type: NotificationType;
          entityId: string;
        };
      }) {
        const duplicate = rows.find(
          (r) =>
            r.userId === args.data.userId &&
            r.actorId === args.data.actorId &&
            r.type === args.data.type &&
            r.entityId === args.data.entityId
        );
        if (duplicate) {
          const error = new Error("duplicate") as Prisma.PrismaClientKnownRequestError;
          Object.assign(error, { code: "P2002" });
          throw error;
        }

        const next: NotificationRow = {
          id: `n_${rows.length + 1}`,
          ...args.data
        };
        rows.push(next);
        return { id: next.id };
      }
    }
  };
}

test("createNotification skips self notifications", async () => {
  const db = createMockDb();
  const res = await createNotification(
    {
      userId: "u1",
      actorId: "u1",
      type: "LIKE",
      entityId: "post_1"
    },
    db
  );
  assert.deepEqual(res, { created: false, reason: "self" });
});

test("createNotification creates once then dedupes duplicates", async () => {
  const db = createMockDb();

  const first = await createNotification(
    {
      userId: "owner",
      actorId: "actor",
      type: "LIKE",
      entityId: "post_1"
    },
    db
  );
  assert.deepEqual(first, { created: true, reason: "created" });

  const second = await createNotification(
    {
      userId: "owner",
      actorId: "actor",
      type: "LIKE",
      entityId: "post_1"
    },
    db
  );
  assert.deepEqual(second, { created: false, reason: "duplicate" });
});

test("notifyPostLiked uses LIKE + postId dedupe key", async () => {
  const db = createMockDb();
  const first = await notifyPostLiked(
    { recipientUserId: "owner", actorId: "actor", postId: "post_9" },
    db
  );
  const second = await notifyPostLiked(
    { recipientUserId: "owner", actorId: "actor", postId: "post_9" },
    db
  );
  assert.equal(first.reason, "created");
  assert.equal(second.reason, "duplicate");
});

test("notifyPostCommented is one-notification-per-comment-id", async () => {
  const db = createMockDb();
  const first = await notifyPostCommented(
    { recipientUserId: "owner", actorId: "actor", commentId: "comment_1" },
    db
  );
  const second = await notifyPostCommented(
    { recipientUserId: "owner", actorId: "actor", commentId: "comment_1" },
    db
  );
  const third = await notifyPostCommented(
    { recipientUserId: "owner", actorId: "actor", commentId: "comment_2" },
    db
  );

  assert.equal(first.reason, "created");
  assert.equal(second.reason, "duplicate");
  assert.equal(third.reason, "created");
});

test("notifyUserFollowed is one-notification-per-follow-pair", async () => {
  const db = createMockDb();
  const first = await notifyUserFollowed(
    { followedUserId: "target", actorId: "follower" },
    db
  );
  const second = await notifyUserFollowed(
    { followedUserId: "target", actorId: "follower" },
    db
  );

  assert.equal(first.reason, "created");
  assert.equal(second.reason, "duplicate");
});
