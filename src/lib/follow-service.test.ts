import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import {
  countFollowers,
  countFollowing,
  followUser,
  getFollowState,
  unfollowUser
} from "@/lib/follow-service";

type FollowRow = {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
};

function createMockDb(seed: FollowRow[] = []) {
  let rows = [...seed];

  return {
    userFollow: {
      async findUnique(args: {
        where: { followerId_followingId: { followerId: string; followingId: string } };
      }) {
        const key = args.where.followerId_followingId;
        return (
          rows.find(
            (r) => r.followerId === key.followerId && r.followingId === key.followingId
          ) ?? null
        );
      },
      async create(args: { data: { followerId: string; followingId: string } }) {
        const duplicate = rows.find(
          (r) =>
            r.followerId === args.data.followerId &&
            r.followingId === args.data.followingId
        );
        if (duplicate) {
          const error = new Error("duplicate") as Prisma.PrismaClientKnownRequestError;
          Object.assign(error, { code: "P2002" });
          throw error;
        }

        const next: FollowRow = {
          id: `f_${rows.length + 1}`,
          followerId: args.data.followerId,
          followingId: args.data.followingId,
          createdAt: new Date()
        };
        rows.push(next);
        return next;
      },
      async deleteMany(args: { where: { followerId: string; followingId: string } }) {
        const before = rows.length;
        rows = rows.filter(
          (r) =>
            !(
              r.followerId === args.where.followerId &&
              r.followingId === args.where.followingId
            )
        );
        return { count: before - rows.length };
      },
      async count(args: { where: { followingId?: string; followerId?: string } }) {
        return rows.filter((r) => {
          if (args.where.followingId != null) {
            return r.followingId === args.where.followingId;
          }
          if (args.where.followerId != null) {
            return r.followerId === args.where.followerId;
          }
          return false;
        }).length;
      }
    }
  };
}

test("followUser creates relation and returns typed state", async () => {
  const db = createMockDb();
  const state = await followUser({ followerId: "u1", followingId: "u2" }, db);

  assert.deepEqual(state, {
    viewerId: "u1",
    targetUserId: "u2",
    isFollowing: true,
    followersCount: 1,
    followingCount: 0
  });
});

test("followUser is duplicate-safe and idempotent", async () => {
  const db = createMockDb([
    { id: "f1", followerId: "u1", followingId: "u2", createdAt: new Date() }
  ]);

  const state = await followUser({ followerId: "u1", followingId: "u2" }, db);
  assert.equal(state.isFollowing, true);
  assert.equal(state.followersCount, 1);
});

test("followUser rejects self-follow", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => followUser({ followerId: "u1", followingId: "u1" }, db),
    /Cannot follow yourself\./
  );
});

test("unfollowUser is idempotent and returns updated state", async () => {
  const db = createMockDb([
    { id: "f1", followerId: "u1", followingId: "u2", createdAt: new Date() }
  ]);
  const state = await unfollowUser({ followerId: "u1", followingId: "u2" }, db);

  assert.equal(state.isFollowing, false);
  assert.equal(state.followersCount, 0);
  assert.equal(state.followingCount, 0);
});

test("count helpers and getFollowState return expected values", async () => {
  const db = createMockDb([
    { id: "f1", followerId: "u1", followingId: "u2", createdAt: new Date() },
    { id: "f2", followerId: "u3", followingId: "u2", createdAt: new Date() },
    { id: "f3", followerId: "u2", followingId: "u4", createdAt: new Date() }
  ]);

  const followers = await countFollowers("u2", db);
  const following = await countFollowing("u2", db);
  const state = await getFollowState("u1", "u2", db);

  assert.equal(followers, 2);
  assert.equal(following, 1);
  assert.deepEqual(state, {
    viewerId: "u1",
    targetUserId: "u2",
    isFollowing: true,
    followersCount: 2,
    followingCount: 1
  });
});
