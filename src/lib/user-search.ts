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
 * Discover / search row (FEAT-134). `username` is the stored handle only (`null` if unset — never
 * email). `displayName` is name → username → email. UIs show `@username` as a second line only
 * when it differs from `displayName`.
 */
export type PublicUserSearchHit = {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Viewer has an APPROVED follow to this user. */
  isFollowing: boolean;
};

/** Public handle for APIs: normalized `username` when set, else email (FEAT-127). */
export function userPublicHandle(user: {
  email: string;
  username?: string | null;
}): string {
  return user.username != null && user.username.length > 0
    ? user.username
    : user.email;
}

/**
 * FEAT-134: List/search primary label — prefer real name, then public handle, then email.
 */
export function userPublicDisplayName(user: {
  email: string;
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
  return user.email;
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
 * Maps DB user to API shape for Discover / search (FEAT-134).
 */
export function mapUserToSearchHit(
  user: {
    id: string;
    email: string;
    name: string | null;
    username?: string | null;
  },
  isFollowing: boolean
): PublicUserSearchHit {
  const handle =
    user.username != null && user.username.length > 0 ? user.username : null;
  return {
    userId: user.id,
    username: handle,
    displayName: userPublicDisplayName(user),
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
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { email: { contains: trimmed, mode: "insensitive" } },
        { username: { contains: trimmed, mode: "insensitive" } }
      ]
    },
    select: { id: true, email: true, name: true, username: true },
    take: limit,
    orderBy: [{ name: "asc" }, { email: "asc" }, { username: "asc" }]
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

  return rows.map((r) => mapUserToSearchHit(r, followingIds.has(r.id)));
}

/**
 * Suggested users for discover (FEAT-122).
 *
 * **MVP logic:** random sample via PostgreSQL `ORDER BY RANDOM()` over the eligible pool.
 * **Perf follow-up:** at scale, replace with precomputed buckets, keyset pagination, or
 * approximate randomness to avoid full-table sorts.
 *
 * Eligible: not the viewer, `profileVisibility = PUBLIC`, and no existing follow row
 * where this viewer is the follower (any approval status). `isFollowing` is always false.
 */
export async function suggestUsersForViewer(
  viewerId: string,
  limit: number,
  db: SuggestUsersDb
): Promise<PublicUserSearchHit[]> {
  const rows = await db.$queryRaw<
    Array<{ id: string; email: string; name: string | null; username: string | null }>
  >`
    SELECT u.id, u.email, u.name, u.username
    FROM "User" u
    WHERE u.id != ${viewerId}
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
