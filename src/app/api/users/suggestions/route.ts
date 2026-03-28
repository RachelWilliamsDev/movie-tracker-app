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
 * GET /api/users/suggestions
 *
 * Query: `limit` (optional), default 8, max 12.
 * Auth: session required.
 *
 * Returns `{ ok: true, users: PublicUserSearchHit[] }` — same shape as search, for discover rows.
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
