import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import {
  clampSuggestionsLimit,
  suggestUsersForViewer
} from "@/lib/user-search";

/**
 * GET /api/users/suggestions (FEAT-122 / MEM-60)
 *
 * Auth: session required (401 if not signed in).
 *
 * Query: `limit` (optional) — clamped to **5–10**; default **8**. Fewer rows are returned if
 * the eligible pool is smaller (no pagination).
 *
 * **MVP selection:** uniform random sample (`ORDER BY RANDOM()` on Postgres) from users who are
 * not the viewer, have **public** profiles, and are not already followed by the viewer
 * (no `UserFollow` row with this viewer as follower). Same response type as
 * `GET /api/users/search` (`PublicUserSearchHit[]`) for `DiscoverUserRow`.
 *
 * **Performance:** full random sort is acceptable at MVP scale; consider precomputed or
 * approximate randomness if the user table grows large.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  const url = new URL(request.url);
  const limit = clampSuggestionsLimit(url.searchParams.get("limit"));

  try {
    const users = await suggestUsersForViewer(viewerId, limit, prisma);
    return NextResponse.json({
      ok: true,
      users,
      meta: { limit, count: users.length }
    });
  } catch {
    return jsonApiError(
      500,
      "Could not load suggestions.",
      "SUGGESTIONS_FAILED"
    );
  }
}
