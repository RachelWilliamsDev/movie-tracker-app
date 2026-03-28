import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  USER_SEARCH_MAX_LIMIT,
  clampUserSearchLimit,
  mapUserToSearchHit,
  searchUsersForViewer
} from "@/lib/user-search";

test("clampUserSearchLimit caps at max", () => {
  assert.equal(clampUserSearchLimit("5"), 5);
  assert.equal(clampUserSearchLimit("100"), USER_SEARCH_MAX_LIMIT);
  assert.equal(clampUserSearchLimit("0"), USER_SEARCH_MAX_LIMIT);
  assert.equal(clampUserSearchLimit("nope"), USER_SEARCH_MAX_LIMIT);
  assert.equal(clampUserSearchLimit(null), USER_SEARCH_MAX_LIMIT);
});

test("mapUserToSearchHit uses name as displayName when present", () => {
  const hit = mapUserToSearchHit({
    id: "u1",
    email: "a@b.com",
    name: "  Ada  "
  });
  assert.equal(hit.userId, "u1");
  assert.equal(hit.username, "a@b.com");
  assert.equal(hit.displayName, "Ada");
  assert.equal(hit.avatarUrl, null);
});

test("mapUserToSearchHit falls back displayName to email", () => {
  const hit = mapUserToSearchHit({
    id: "u2",
    email: "solo@x.com",
    name: null
  });
  assert.equal(hit.displayName, "solo@x.com");
});

test("searchUsersForViewer returns empty for blank query", async () => {
  const db = {
    user: {
      findMany: async () => {
        throw new Error("should not query");
      }
    }
  } as unknown as Pick<PrismaClient, "user">;
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
    }
  } as unknown as Pick<PrismaClient, "user">;

  const out = await searchUsersForViewer("me", "pat", 15, db);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.userId, "other");
  assert.equal(out[0]?.displayName, "Pat");
  assert.ok(captured);
  assert.equal(captured!.take, 15);
});
