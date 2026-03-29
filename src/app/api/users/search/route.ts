import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import {
  clampUserSearchLimit,
  searchUsersForViewer
} from "@/lib/user-search";

/**
 * GET /api/users/search
 *
 * Query params:
 * - `q` (string, optional): Substring to match against `User.name`, `User.username`, or `User.email`
 *   (case-insensitive) for lookup only. **Response never includes email** (FEAT-136). Only users with
 *   a non-null `username` are returned.
 * - `limit` (number, optional): Max results, default 20, hard cap 20, minimum treated as default if invalid.
 *
 * Auth: requires session. 401 if unauthenticated.
 *
 * Success 200: `{ ok: true, users: UserSearchHit[], meta: { limit: number, count: number } }`
 * Each hit: `{ userId, username, displayName, avatarUrl, isFollowing }` — `username` is always the
 * stored handle; `displayName` is name → username → `"Member"` (never email). `avatarUrl` is null in MVP.
 *
 * Errors:
 * - 401 `{ error: "Unauthorized", code: "UNAUTHORIZED" }` — not signed in
 * - 500 `{ error: "Could not search users.", code: "SEARCH_FAILED" }` — unexpected server failure
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = clampUserSearchLimit(url.searchParams.get("limit"));

  try {
    const users = await searchUsersForViewer(viewerId, q, limit, prisma);
    return NextResponse.json({
      ok: true,
      users,
      meta: { limit, count: users.length }
    });
  } catch {
    return jsonApiError(
      500,
      "Could not search users.",
      "SEARCH_FAILED"
    );
  }
}
