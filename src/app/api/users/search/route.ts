import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  clampUserSearchLimit,
  searchUsersForViewer
} from "@/lib/user-search";

/**
 * GET /api/users/search
 *
 * Query params:
 * - `q` (string, optional): Substring to match against display name (`User.name`) and
 *   account email (case-insensitive). Empty or omitted `q` returns an empty `users` array.
 * - `limit` (number, optional): Max results, default 20, hard cap 20, minimum treated as default if invalid.
 *
 * Auth: requires session. 401 if unauthenticated.
 *
 * Success 200: `{ ok: true, users: UserSearchHit[], meta: { limit: number, count: number } }`
 * Each hit: `{ userId, username, displayName, avatarUrl }` — `username` is email until a dedicated
 * username column exists; `avatarUrl` is always null in MVP.
 *
 * Errors:
 * - 401 `{ error: "Unauthorized" }` — not signed in
 * - 500 `{ error: "Could not search users." }` — unexpected server failure
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json(
      { error: "Could not search users." },
      { status: 500 }
    );
  }
}
