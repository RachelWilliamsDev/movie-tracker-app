import type { PrismaClient } from "@prisma/client";

/** Hard cap per FEAT-116 (document in API). */
export const USER_SEARCH_MAX_LIMIT = 20;

export function clampUserSearchLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "20", 10);
  if (!Number.isFinite(n) || n < 1) {
    return USER_SEARCH_MAX_LIMIT;
  }
  return Math.min(Math.floor(n), USER_SEARCH_MAX_LIMIT);
}

export type PublicUserSearchHit = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

/**
 * Maps DB user to API shape. There is no separate `username` column yet; `username`
 * is the account email (ticket: fallback when no username field).
 */
export function mapUserToSearchHit(user: {
  id: string;
  email: string;
  name: string | null;
}): PublicUserSearchHit {
  const trimmedName = user.name?.trim();
  const displayName =
    trimmedName && trimmedName.length > 0 ? trimmedName : user.email;
  return {
    userId: user.id,
    username: user.email,
    displayName,
    avatarUrl: null
  };
}

export async function searchUsersForViewer(
  viewerId: string,
  q: string,
  limit: number,
  db: Pick<PrismaClient, "user">
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

  return rows.map(mapUserToSearchHit);
}
