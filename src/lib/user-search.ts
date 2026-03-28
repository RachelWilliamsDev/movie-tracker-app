import type { PrismaClient } from "@prisma/client";

/** Hard cap per FEAT-116 (document in API). */
export const USER_SEARCH_MAX_LIMIT = 20;

/** Hard cap for GET /api/users/suggestions. */
export const USER_SUGGESTIONS_MAX_LIMIT = 12;

const DEFAULT_SUGGESTIONS_LIMIT = 8;

export function clampUserSearchLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "20", 10);
  if (!Number.isFinite(n) || n < 1) {
    return USER_SEARCH_MAX_LIMIT;
  }
  return Math.min(Math.floor(n), USER_SEARCH_MAX_LIMIT);
}

export function clampSuggestionsLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? String(DEFAULT_SUGGESTIONS_LIMIT), 10);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_SUGGESTIONS_LIMIT;
  }
  return Math.min(Math.floor(n), USER_SUGGESTIONS_MAX_LIMIT);
}

export type PublicUserSearchHit = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** Viewer has an APPROVED follow to this user. */
  isFollowing: boolean;
};

/**
 * Maps DB user to API shape. There is no separate `username` column yet; `username`
 * is the account email (ticket: fallback when no username field).
 */
export function mapUserToSearchHit(
  user: {
    id: string;
    email: string;
    name: string | null;
  },
  isFollowing: boolean
): PublicUserSearchHit {
  const trimmedName = user.name?.trim();
  const displayName =
    trimmedName && trimmedName.length > 0 ? trimmedName : user.email;
  return {
    userId: user.id,
    username: user.email,
    displayName,
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
        { email: { contains: trimmed, mode: "insensitive" } }
      ]
    },
    select: { id: true, email: true, name: true },
    take: limit,
    orderBy: [{ name: "asc" }, { email: "asc" }]
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
 * Users the viewer does not yet follow (no `UserFollow` row with this viewer as follower).
 * Ordered deterministically for MVP. `isFollowing` is always false for returned rows.
 */
export async function suggestUsersForViewer(
  viewerId: string,
  limit: number,
  db: Pick<PrismaClient, "user">
): Promise<PublicUserSearchHit[]> {
  const rows = await db.user.findMany({
    where: {
      id: { not: viewerId },
      followers: {
        none: {
          followerId: viewerId
        }
      }
    },
    select: { id: true, email: true, name: true },
    take: limit,
    orderBy: [{ name: "asc" }, { email: "asc" }]
  });

  return rows.map((r) => mapUserToSearchHit(r, false));
}
