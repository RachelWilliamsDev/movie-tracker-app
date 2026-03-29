import assert from "node:assert/strict";
import test from "node:test";
import { pathnameRequiresUsername } from "@/lib/username-gate";

test("pathnameRequiresUsername matches discover feed profile and children", () => {
  assert.equal(pathnameRequiresUsername("/discover"), true);
  assert.equal(pathnameRequiresUsername("/discover/foo"), true);
  assert.equal(pathnameRequiresUsername("/feed"), true);
  assert.equal(pathnameRequiresUsername("/feed/x"), true);
  assert.equal(pathnameRequiresUsername("/profile"), true);
  assert.equal(pathnameRequiresUsername("/profile/cuid123"), true);
  assert.equal(pathnameRequiresUsername("/profile/followers"), true);
});

test("pathnameRequiresUsername allows home show and choose-username", () => {
  assert.equal(pathnameRequiresUsername("/"), false);
  assert.equal(pathnameRequiresUsername("/show/123"), false);
  assert.equal(pathnameRequiresUsername("/choose-username"), false);
  assert.equal(pathnameRequiresUsername("/api/me/profile"), false);
});
