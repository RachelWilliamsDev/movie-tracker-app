import type { PrismaClient } from "@prisma/client";

/** DB surface required for random suggestions (FEAT-122). */
export type SuggestUsersDb = Pick<PrismaClient, "$queryRaw">;

/** Hard cap per FEAT-116 (document in API). */
export const USER_SEARCH_MAX_LIMIT = 20;

/** FEAT-122: API returns up to this many suggestions (inclusive range 5–10). */
export const USER_SUGGESTIONS_MIN_LIMIT = 5;
export const USER_SUGGESTIONS_MAX_LIMIT = 10;

/** Default `limit` for suggestions API and Discover UI (FEAT-122 / FEAT-123). */
export const USER_SUGGESTIONS_DEFAULT_LIMIT = 8;

export function clampUserSearchLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "20", 10);
  if (!Number.isFinite(n) || n < 1) {
    return USER_SEARCH_MAX_LIMIT;
  }
  return Math.min(Math.floor(n), USER_SEARCH_MAX_LIMIT);
}

export function clampSuggestionsLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? String(USER_SUGGESTIONS_DEFAULT_LIMIT), 10);
  if (!Number.isFinite(n) || n < USER_SUGGESTIONS_MIN_LIMIT) {
    return USER_SUGGESTIONS_DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(n), USER_SUGGESTIONS_MAX_LIMIT);
}

/**
 * Discover / search row (FEAT-134 / FEAT-136). Only users with a stored `username` are returned
 * from search/suggestions. Response never includes email.
 */
export type PublicUserSearchHit = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** Viewer has an APPROVED follow to this user. */
  isFollowing: boolean;
};

/**
 * FEAT-136: Display label for social surfaces (lists, profile header, activity) — never email.
 */
export function userSocialDisplayName(user: {
  name?: string | null;
  username?: string | null;
}): string {
  const trimmedName = user.name?.trim();
  if (trimmedName && trimmedName.length > 0) {
    return trimmedName;
  }
  if (user.username != null && user.username.length > 0) {
    return user.username;
  }
  return "Member";
}

/** FEAT-132/134: canonical public profile URL when a handle exists. */
export function profilePathForUser(
  userId: string,
  username: string | null | undefined
): string {
  if (username != null && username.length > 0) {
    return `/user/${encodeURIComponent(username)}`;
  }
  return `/profile/${encodeURIComponent(userId)}`;
}

/**
 * Maps a user row that already has a non-null `username` to the public search hit shape (FEAT-136).
 */
export function mapUserToSearchHit(
  user: {
    id: string;
    name: string | null;
    username: string;
  },
  isFollowing: boolean
): PublicUserSearchHit {
  return {
    userId: user.id,
    username: user.username,
    displayName: userSocialDisplayName(user),
    avatarUrl: null,
    isFollowing
  };
}

export async function searchUsersForViewer(
  viewerId: string,
  q: string,
  limit: number,
  db: Pick<PrismaClient, "user" | "userFollow">
): Promise<PublicUserSearchHit[]> {
  const trimmed = q.trim();
  if (!trimmed) {
    return [];
  }

  const rows = await db.user.findMany({
    where: {
      id: { not: viewerId },
      username: { not: null },
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { email: { contains: trimmed, mode: "insensitive" } },
        { username: { contains: trimmed, mode: "insensitive" } }
      ]
    },
    select: { id: true, name: true, username: true },
    take: limit,
    orderBy: [{ name: "asc" }, { username: "asc" }]
  });

  const ids = rows.map((r) => r.id);
  let followingIds = new Set<string>();
  if (ids.length > 0) {
    const follows = await db.userFollow.findMany({
      where: {
        followerId: viewerId,
        followingId: { in: ids },
        approvalStatus: "APPROVED"
      },
      select: { followingId: true }
    });
    followingIds = new Set(follows.map((f) => f.followingId));
  }

  const withHandle = rows.filter(
    (r): r is typeof r & { username: string } =>
      r.username != null && r.username.length > 0
  );

  return withHandle.map((r) =>
    mapUserToSearchHit(
      {
        id: r.id,
        name: r.name,
        username: r.username
      },
      followingIds.has(r.id)
    )
  );
}

/**
 * Suggested users for discover (FEAT-122). Eligible users must have `username` set (FEAT-136).
 */
export async function suggestUsersForViewer(
  viewerId: string,
  limit: number,
  db: SuggestUsersDb
): Promise<PublicUserSearchHit[]> {
  const rows = await db.$queryRaw<
    Array<{ id: string; name: string | null; username: string }>
  >`
    SELECT u.id, u.name, u.username
    FROM "User" u
    WHERE u.id != ${viewerId}
      AND u.username IS NOT NULL
      AND u."profileVisibility" = 'PUBLIC'
      AND NOT EXISTS (
        SELECT 1
        FROM "UserFollow" f
        WHERE f."followerId" = ${viewerId}
          AND f."followingId" = u.id
      )
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  return rows.map((r) => mapUserToSearchHit(r, false));
}
