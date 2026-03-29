import assert from "node:assert/strict";
import test from "node:test";
import { showDetailPathForTmdb } from "@/lib/show-detail-path";

test("showDetailPathForTmdb movie", () => {
  assert.equal(showDetailPathForTmdb("MOVIE", 550), "/show/550?type=movie");
});

test("showDetailPathForTmdb tv", () => {
  assert.equal(showDetailPathForTmdb("TV", 1396), "/show/1396?type=tv");
});
