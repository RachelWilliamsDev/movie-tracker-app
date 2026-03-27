import { Prisma } from "@prisma/client";

export type FollowState = {
  viewerId: string;
  targetUserId: string;
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
};

type FollowRow = {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
};

type FollowDb = {
  userFollow: {
    findUnique(args: {
      where: { followerId_followingId: { followerId: string; followingId: string } };
    }): Promise<FollowRow | null>;
    create(args: { data: { followerId: string; followingId: string } }): Promise<FollowRow>;
    deleteMany(args: { where: { followerId: string; followingId: string } }): Promise<{ count: number }>;
    count(args: { where: { followingId?: string; followerId?: string } }): Promise<number>;
  };
};

type FollowUserInput = {
  followerId: string;
  followingId: string;
};

type UnfollowUserInput = FollowUserInput;

function assertNoSelfFollow(followerId: string, followingId: string): void {
  if (followerId === followingId) {
    throw new Error("Cannot follow yourself.");
  }
}

async function createIfMissing(
  db: FollowDb,
  followerId: string,
  followingId: string
): Promise<FollowRow | null> {
  const existing = await db.userFollow.findUnique({
    where: { followerId_followingId: { followerId, followingId } }
  });
  if (existing) {
    return null;
  }

  try {
    return await db.userFollow.create({ data: { followerId, followingId } });
  } catch (error) {
    // Guard against races where another request created the same row first.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }
    throw error;
  }
}

async function getDb(db?: FollowDb): Promise<FollowDb> {
  if (db) {
    return db;
  }
  const { prisma } = await import("@/lib/prisma");
  return prisma as unknown as FollowDb;
}

export async function countFollowers(userId: string, db?: FollowDb): Promise<number> {
  const resolvedDb = await getDb(db);
  return resolvedDb.userFollow.count({ where: { followingId: userId } });
}

export async function countFollowing(userId: string, db?: FollowDb): Promise<number> {
  const resolvedDb = await getDb(db);
  return resolvedDb.userFollow.count({ where: { followerId: userId } });
}

export async function getFollowState(
  viewerId: string,
  targetUserId: string,
  db?: FollowDb
): Promise<FollowState> {
  const resolvedDb = await getDb(db);
  const [existing, followersCount, followingCount] = await Promise.all([
    resolvedDb.userFollow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: targetUserId } }
    }),
    countFollowers(targetUserId, resolvedDb),
    countFollowing(targetUserId, resolvedDb)
  ]);

  return {
    viewerId,
    targetUserId,
    isFollowing: existing != null,
    followersCount,
    followingCount
  };
}

export async function followUser(
  input: FollowUserInput,
  db?: FollowDb
): Promise<FollowState> {
  const resolvedDb = await getDb(db);
  const { followerId, followingId } = input;
  assertNoSelfFollow(followerId, followingId);
  await createIfMissing(resolvedDb, followerId, followingId);
  return getFollowState(followerId, followingId, resolvedDb);
}

export async function unfollowUser(
  input: UnfollowUserInput,
  db?: FollowDb
): Promise<FollowState> {
  const resolvedDb = await getDb(db);
  const { followerId, followingId } = input;
  assertNoSelfFollow(followerId, followingId);
  await resolvedDb.userFollow.deleteMany({ where: { followerId, followingId } });
  return getFollowState(followerId, followingId, resolvedDb);
}
