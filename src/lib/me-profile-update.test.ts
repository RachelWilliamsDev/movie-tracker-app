import assert from "node:assert/strict";
import test from "node:test";
import type { MeProfileUpdatePrisma } from "@/lib/me-profile-update";
import { handleMeProfileUpdate } from "@/lib/me-profile-update";

/**
 * MEM-76: PATCH with username that normalizes to the same DB value → 200, ok: true,
 * and no `user.update` (no spurious unique conflict path).
 */
test("handleMeProfileUpdate: unchanged username returns 200 and skips user.update", async () => {
  const userId = "user_test_mem76";
  let updateCalls = 0;

  const row = {
    id: userId,
    email: "mem76@example.com",
    username: "jane_doe",
    name: null as string | null,
    profileVisibility: "PUBLIC" as const
  };

  const prisma = {
    user: {
      async findUnique(args: { where: { id?: string } }) {
        assert.equal(args.where.id, userId);
        return { username: "jane_doe" as string | null };
      },
      async findUniqueOrThrow(args: { where: { id?: string } }) {
        assert.equal(args.where.id, userId);
        return { ...row };
      },
      async update() {
        updateCalls += 1;
        throw new Error("user.update must not run when username is unchanged");
      }
    }
  } as unknown as MeProfileUpdatePrisma;

  const request = new Request("http://localhost/api/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Jane_Doe" })
  });

  const res = await handleMeProfileUpdate(request, { userId, prisma });
  assert.equal(res.status, 200);
  assert.equal(updateCalls, 0);

  const json = (await res.json()) as {
    ok?: boolean;
    user?: { username?: string | null };
    code?: string;
  };
  assert.equal(json.ok, true);
  assert.equal(json.user?.username, "jane_doe");
  assert.equal(json.code, undefined);
});
