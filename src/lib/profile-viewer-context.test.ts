import assert from "node:assert/strict";
import test from "node:test";
import { resolveProfileViewerContext } from "@/lib/profile-viewer-context";

test("own profile: signed-in viewer matches target", () => {
  const u = resolveProfileViewerContext("user-1", "  user-1  ");
  assert.equal(u.normalizedTargetUserId, "user-1");
  assert.equal(u.isOwnProfile, true);
  assert.equal(u.showFollowAction, false);
  assert.equal(u.viewerSignedIn, true);
});

test("other profile: signed-in viewer", () => {
  const u = resolveProfileViewerContext("viewer", "target");
  assert.equal(u.isOwnProfile, false);
  assert.equal(u.showFollowAction, true);
});

test("anonymous viewer", () => {
  const u = resolveProfileViewerContext(null, "target");
  assert.equal(u.isOwnProfile, false);
  assert.equal(u.showFollowAction, false);
  assert.equal(u.viewerSignedIn, false);
});
