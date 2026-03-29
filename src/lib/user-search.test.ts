import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  USER_SEARCH_MAX_LIMIT,
  USER_SUGGESTIONS_MAX_LIMIT,
  USER_SUGGESTIONS_MIN_LIMIT,
  type SuggestUsersDb,
  clampSuggestionsLimit,
  clampUserSearchLimit,
  mapUserToSearchHit,
  profilePathForUser,
  searchUsersForViewer,
  suggestUsersForViewer,
  userSocialDisplayName
} from "@/lib/user-search";

test("clampUserSearchLimit caps at max", () => {
  assert.equal(clampUserSearchLimit("5"), 5);
  assert.equal(clampUserSearchLimit("100"), USER_SEARCH_MAX_LIMIT);
  assert.equal(clampUserSearchLimit("0"), USER_SEARCH_MAX_LIMIT);
  assert.equal(clampUserSearchLimit("nope"), USER_SEARCH_MAX_LIMIT);
  assert.equal(clampUserSearchLimit(null), USER_SEARCH_MAX_LIMIT);
});

test("userSocialDisplayName never uses email", () => {
  assert.equal(
    userSocialDisplayName({
      name: null,
      username: null
    }),
    "Member"
  );
  assert.equal(
    userSocialDisplayName({
      name: "  Ada  ",
      username: "ada_h"
    }),
    "Ada"
  );
  assert.equal(
    userSocialDisplayName({
      name: null,
      username: "solo_handle"
    }),
    "solo_handle"
  );
});

test("mapUserToSearchHit uses name as displayName when present", () => {
  const hit = mapUserToSearchHit(
    {
      id: "u1",
      name: "  Ada  ",
      username: "ada_lovelace"
    },
    true
  );
  assert.equal(hit.userId, "u1");
  assert.equal(hit.username, "ada_lovelace");
  assert.equal(hit.displayName, "Ada");
  assert.equal(hit.avatarUrl, null);
  assert.equal(hit.isFollowing, true);
});

test("mapUserToSearchHit uses username for displayName when name missing", () => {
  const hit = mapUserToSearchHit(
    {
      id: "u4",
      name: null,
      username: "public_handle"
    },
    false
  );
  assert.equal(hit.username, "public_handle");
  assert.equal(hit.displayName, "public_handle");
});

test("profilePathForUser prefers /user/[username] when handle set", () => {
  assert.equal(profilePathForUser("cuid1", "ada"), "/user/ada");
  assert.equal(profilePathForUser("cuid1", null), "/profile/cuid1");
});

test("searchUsersForViewer returns empty for blank query", async () => {
  const db = {
    user: {
      findMany: async () => {
        throw new Error("should not query");
      }
    },
    userFollow: {
      findMany: async () => {
        throw new Error("should not query follows");
      }
    }
  } as unknown as Pick<PrismaClient, "user" | "userFollow">;
  const out = await searchUsersForViewer("me", "   ", 10, db);
  assert.deepEqual(out, []);
});

test("searchUsersForViewer excludes viewer and maps rows", async () => {
  let captured: { where: object; take: number } | null = null;
  const db = {
    user: {
      findMany: async (args: { where: object; take: number }) => {
        captured = { where: args.where, take: args.take };
        return [
          { id: "other", name: "Pat", username: "pat_handle" }
        ];
      }
    },
    userFollow: {
      findMany: async () => []
    }
  } as unknown as Pick<PrismaClient, "user" | "userFollow">;

  const out = await searchUsersForViewer("me", "pat", 15, db);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.userId, "other");
  assert.equal(out[0]?.displayName, "Pat");
  assert.equal(out[0]?.username, "pat_handle");
  assert.equal(out[0]?.isFollowing, false);
  assert.ok(captured !== null);
  assert.equal((captured as { where: object; take: number }).take, 15);
});

test("searchUsersForViewer sets isFollowing from approved follows", async () => {
  const db = {
    user: {
      findMany: async () => [
        { id: "other", name: "Pat", username: "pat_handle" }
      ]
    },
    userFollow: {
      findMany: async () => [{ followingId: "other" }]
    }
  } as unknown as Pick<PrismaClient, "user" | "userFollow">;

  const out = await searchUsersForViewer("me", "pat", 15, db);
  assert.equal(out[0]?.isFollowing, true);
});

test("searchUsersForViewer drops rows without username", async () => {
  const db = {
    user: {
      findMany: async () => [
        { id: "a", name: "X", username: null },
        { id: "b", name: "Y", username: "y_handle" }
      ]
    },
    userFollow: {
      findMany: async () => []
    }
  } as unknown as Pick<PrismaClient, "user" | "userFollow">;

  const out = await searchUsersForViewer("me", "y", 15, db);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.userId, "b");
});

test("clampSuggestionsLimit defaults and FEAT-122 5–10 band", () => {
  assert.equal(clampSuggestionsLimit(null), 8);
  assert.equal(clampSuggestionsLimit("5"), USER_SUGGESTIONS_MIN_LIMIT);
  assert.equal(clampSuggestionsLimit("10"), USER_SUGGESTIONS_MAX_LIMIT);
  assert.equal(clampSuggestionsLimit("4"), 8);
  assert.equal(clampSuggestionsLimit("999"), USER_SUGGESTIONS_MAX_LIMIT);
  assert.equal(clampSuggestionsLimit("0"), 8);
});

test("suggestUsersForViewer maps $queryRaw rows", async () => {
  const db = {
    $queryRaw: async () => [
      { id: "u2", name: "Bo", username: "bo_handle" }
    ]
  } as unknown as SuggestUsersDb;

  const out = await suggestUsersForViewer("me", 6, db);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.userId, "u2");
  assert.equal(out[0]?.username, "bo_handle");
  assert.equal(out[0]?.isFollowing, false);
});
