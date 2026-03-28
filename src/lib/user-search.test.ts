import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  USER_SEARCH_MAX_LIMIT,
  USER_SUGGESTIONS_MAX_LIMIT,
  clampSuggestionsLimit,
  clampUserSearchLimit,
  mapUserToSearchHit,
  searchUsersForViewer,
  suggestUsersForViewer
} from "@/lib/user-search";

test("clampUserSearchLimit caps at max", () => {
  assert.equal(clampUserSearchLimit("5"), 5);
  assert.equal(clampUserSearchLimit("100"), USER_SEARCH_MAX_LIMIT);
  assert.equal(clampUserSearchLimit("0"), USER_SEARCH_MAX_LIMIT);
  assert.equal(clampUserSearchLimit("nope"), USER_SEARCH_MAX_LIMIT);
  assert.equal(clampUserSearchLimit(null), USER_SEARCH_MAX_LIMIT);
});

test("mapUserToSearchHit uses name as displayName when present", () => {
  const hit = mapUserToSearchHit(
    {
      id: "u1",
      email: "a@b.com",
      name: "  Ada  "
    },
    true
  );
  assert.equal(hit.userId, "u1");
  assert.equal(hit.username, "a@b.com");
  assert.equal(hit.displayName, "Ada");
  assert.equal(hit.avatarUrl, null);
  assert.equal(hit.isFollowing, true);
});

test("mapUserToSearchHit falls back displayName to email", () => {
  const hit = mapUserToSearchHit(
    {
      id: "u2",
      email: "solo@x.com",
      name: null
    },
    false
  );
  assert.equal(hit.displayName, "solo@x.com");
  assert.equal(hit.isFollowing, false);
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
          { id: "other", email: "o@z.com", name: "Pat" }
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
  assert.equal(out[0]?.isFollowing, false);
  assert.ok(captured);
  assert.equal(captured!.take, 15);
});

test("searchUsersForViewer sets isFollowing from approved follows", async () => {
  const db = {
    user: {
      findMany: async () => [
        { id: "other", email: "o@z.com", name: "Pat" }
      ]
    },
    userFollow: {
      findMany: async () => [{ followingId: "other" }]
    }
  } as unknown as Pick<PrismaClient, "user" | "userFollow">;

  const out = await searchUsersForViewer("me", "pat", 15, db);
  assert.equal(out[0]?.isFollowing, true);
});

test("clampSuggestionsLimit defaults and caps", () => {
  assert.equal(clampSuggestionsLimit(null), 8);
  assert.equal(clampSuggestionsLimit("4"), 4);
  assert.equal(clampSuggestionsLimit("999"), USER_SUGGESTIONS_MAX_LIMIT);
  assert.equal(clampSuggestionsLimit("0"), 8);
});

test("suggestUsersForViewer excludes viewer and users already followed", async () => {
  let captured: { where: object; take: number } | null = null;
  const db = {
    user: {
      findMany: async (args: { where: object; take: number }) => {
        captured = { where: args.where, take: args.take };
        return [{ id: "u2", email: "b@b.com", name: "Bo" }];
      }
    }
  } as unknown as Pick<PrismaClient, "user">;

  const out = await suggestUsersForViewer("me", 6, db);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.isFollowing, false);
  assert.ok(captured);
  assert.equal(captured!.take, 6);
});
