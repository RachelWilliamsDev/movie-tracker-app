import test from "node:test";
import assert from "node:assert/strict";
import { canViewUserActivityFromPolicy } from "@/lib/activity-visibility-policy";

test("owner always allowed regardless of visibility", () => {
  assert.equal(
    canViewUserActivityFromPolicy({
      viewerId: "a",
      targetUserId: "a",
      profileVisibility: "PRIVATE",
      followApprovalStatus: null
    }),
    true
  );
});

test("public profile: any viewer allowed", () => {
  assert.equal(
    canViewUserActivityFromPolicy({
      viewerId: "b",
      targetUserId: "a",
      profileVisibility: "PUBLIC",
      followApprovalStatus: null
    }),
    true
  );
  assert.equal(
    canViewUserActivityFromPolicy({
      viewerId: null,
      targetUserId: "a",
      profileVisibility: "PUBLIC",
      followApprovalStatus: null
    }),
    true
  );
});

test("private profile: anonymous not allowed", () => {
  assert.equal(
    canViewUserActivityFromPolicy({
      viewerId: null,
      targetUserId: "a",
      profileVisibility: "PRIVATE",
      followApprovalStatus: null
    }),
    false
  );
});

test("private profile: approved follower allowed", () => {
  assert.equal(
    canViewUserActivityFromPolicy({
      viewerId: "b",
      targetUserId: "a",
      profileVisibility: "PRIVATE",
      followApprovalStatus: "APPROVED"
    }),
    true
  );
});

test("private profile: pending follow does not grant access", () => {
  assert.equal(
    canViewUserActivityFromPolicy({
      viewerId: "b",
      targetUserId: "a",
      profileVisibility: "PRIVATE",
      followApprovalStatus: "PENDING"
    }),
    false
  );
});

test("private profile: non-follower not allowed", () => {
  assert.equal(
    canViewUserActivityFromPolicy({
      viewerId: "b",
      targetUserId: "a",
      profileVisibility: "PRIVATE",
      followApprovalStatus: null
    }),
    false
  );
});
