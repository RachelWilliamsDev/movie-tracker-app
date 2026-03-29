import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { handleMeProfileUpdate } from "@/lib/me-profile-update";
import { prisma } from "@/lib/prisma";
import type { ProfileVisibility } from "@prisma/client";

type MeProfileResponse = {
  ok: true;
  user: {
    id: string;
    email: string;
    username: string | null;
    displayName: string | null;
    profileVisibility: ProfileVisibility;
  };
};

/**
 * GET `/api/me/profile` (FEAT-131)
 *
 * Auth: session required → 401. Success 200 same body shape as PATCH success.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      profileVisibility: true
    }
  });

  if (!user) {
    return jsonApiError(404, "User not found.", "NOT_FOUND");
  }

  const payload: MeProfileResponse = {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.name,
      profileVisibility: user.profileVisibility
    }
  };

  return NextResponse.json(payload);
}

/**
 * PATCH | PUT `/api/me/profile` (FEAT-130)
 *
 * Auth: session required → 401 `UNAUTHORIZED`.
 *
 * Body (JSON, all optional unless noted):
 * - `username` — string (FEAT-128 rules) or `null` to clear. Normalized to lowercase on save.
 * - `displayName` — string or `null`; maps to `User.name`, trimmed, max 200 chars.
 * - `profileVisibility` — `PUBLIC` | `PRIVATE`.
 *
 * **Email is not writable:** if the JSON body includes an `email` key → 403 `FORBIDDEN` (MVP).
 *
 * Success 200: `{ ok: true, user: { id, email, username, displayName, profileVisibility } }`
 *
 * Errors:
 * - 400 `BAD_REQUEST` — invalid JSON, bad field types, invalid visibility, display name too long.
 * - 400 + FEAT-128 codes — invalid username (`USERNAME_*` from `parseUsername`).
 * - 403 `FORBIDDEN` — client sent `email` in the body.
 * - 409 `USERNAME_TAKEN` — duplicate username (unique constraint).
 *
 * **FEAT-133 (MEM-71):** If the normalized username equals the value already stored for this
 * user, the username field is not written (no unnecessary unique checks / writes). Clearing
 * username when already null is also a no-op. **MVP:** no per-month change cap. After a
 * successful change, old `/user/previous-name` URLs 404 (no redirect).
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  return handleMeProfileUpdate(request, {
    userId: session?.user?.id,
    prisma
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  return handleMeProfileUpdate(request, {
    userId: session?.user?.id,
    prisma
  });
}
