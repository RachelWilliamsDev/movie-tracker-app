import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import type { ProfileVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { normalizeUsernameForDb, parseUsername } from "@/lib/username";

const DISPLAY_NAME_MAX_LEN = 200;

function isProfileVisibility(v: unknown): v is ProfileVisibility {
  return v === "PUBLIC" || v === "PRIVATE";
}

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
 */
async function handleProfileUpdate(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return jsonApiError(401, "Unauthorized", "UNAUTHORIZED");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonApiError(400, "Invalid JSON body.", "BAD_REQUEST");
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return jsonApiError(400, "Body must be a JSON object.", "BAD_REQUEST");
  }

  const record = body as Record<string, unknown>;

  if (Object.hasOwn(record, "email")) {
    return jsonApiError(
      403,
      "Email cannot be changed via this endpoint.",
      "FORBIDDEN"
    );
  }

  const data: Prisma.UserUpdateInput = {};

  if (Object.hasOwn(record, "username")) {
    const raw = record.username;
    if (raw === null) {
      data.username = null;
    } else if (typeof raw === "string") {
      const parsed = parseUsername(raw);
      if (!parsed.ok) {
        return jsonApiError(400, parsed.error.message, parsed.error.code);
      }
      data.username = normalizeUsernameForDb(parsed.username);
    } else {
      return jsonApiError(
        400,
        "username must be a string or null.",
        "BAD_REQUEST"
      );
    }
  }

  if (Object.hasOwn(record, "displayName")) {
    const raw = record.displayName;
    if (raw === null) {
      data.name = null;
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length > DISPLAY_NAME_MAX_LEN) {
        return jsonApiError(
          400,
          `Display name must be at most ${DISPLAY_NAME_MAX_LEN} characters.`,
          "BAD_REQUEST"
        );
      }
      data.name = trimmed.length === 0 ? null : trimmed;
    } else {
      return jsonApiError(
        400,
        "displayName must be a string or null.",
        "BAD_REQUEST"
      );
    }
  }

  if (Object.hasOwn(record, "profileVisibility")) {
    const v = record.profileVisibility;
    if (!isProfileVisibility(v)) {
      return jsonApiError(
        400,
        "profileVisibility must be PUBLIC or PRIVATE.",
        "BAD_REQUEST"
      );
    }
    data.profileVisibility = v;
  }

  try {
    const updated =
      Object.keys(data).length === 0
        ? await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              username: true,
              name: true,
              profileVisibility: true
            }
          })
        : await prisma.user.update({
            where: { id: userId },
            data,
            select: {
              id: true,
              email: true,
              username: true,
              name: true,
              profileVisibility: true
            }
          });

    const payload: MeProfileResponse = {
      ok: true,
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        displayName: updated.name,
        profileVisibility: updated.profileVisibility
      }
    };

    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        const target = e.meta?.target;
        const fields = Array.isArray(target)
          ? target
          : typeof target === "string"
            ? [target]
            : [];
        if (fields.some((f) => f === "username")) {
          return jsonApiError(
            409,
            "That username is already taken.",
            "USERNAME_TAKEN"
          );
        }
      }
      if (e.code === "P2025") {
        return jsonApiError(404, "User not found.", "NOT_FOUND");
      }
    }
    throw e;
  }
}

export async function PATCH(request: Request) {
  return handleProfileUpdate(request);
}

export async function PUT(request: Request) {
  return handleProfileUpdate(request);
}
