import assert from "node:assert/strict";
import test from "node:test";
import {
  endFollowToggle,
  isStaleFollowResponse,
  optimisticFollowersCount,
  tryBeginFollowToggle
} from "@/lib/follow-action-guards";

test("optimisticFollowersCount increments on follow", () => {
  assert.equal(optimisticFollowersCount(false, true, 3), 4);
});

test("optimisticFollowersCount decrements on unfollow", () => {
  assert.equal(optimisticFollowersCount(true, false, 3), 2);
});

test("optimisticFollowersCount no-op when unchanged", () => {
  assert.equal(optimisticFollowersCount(true, true, 5), 5);
});

test("optimisticFollowersCount floors at zero", () => {
  assert.equal(optimisticFollowersCount(true, false, 0), 0);
});

test("isStaleFollowResponse true when ids differ", () => {
  assert.equal(isStaleFollowResponse(1, 2), true);
});

test("isStaleFollowResponse false when ids match", () => {
  assert.equal(isStaleFollowResponse(3, 3), false);
});

test("tryBeginFollowToggle dedupes same target until end", () => {
  const id = "user-a";
  assert.equal(tryBeginFollowToggle(id), true);
  assert.equal(tryBeginFollowToggle(id), false);
  endFollowToggle(id);
  assert.equal(tryBeginFollowToggle(id), true);
  endFollowToggle(id);
});

test("different targets do not block each other", () => {
  assert.equal(tryBeginFollowToggle("u1"), true);
  assert.equal(tryBeginFollowToggle("u2"), true);
  endFollowToggle("u1");
  endFollowToggle("u2");
});

test("simulated race: only latest request id is current", () => {
  let latest = 0;
  const r1 = ++latest;
  const r2 = ++latest;
  assert.equal(isStaleFollowResponse(r1, latest), true);
  assert.equal(isStaleFollowResponse(r2, latest), false);
});

test("retry after failed toggle releases dedupe slot", () => {
  const id = "u-retry-flow";
  assert.equal(tryBeginFollowToggle(id), true);
  endFollowToggle(id);
  assert.equal(tryBeginFollowToggle(id), true);
  endFollowToggle(id);
});
