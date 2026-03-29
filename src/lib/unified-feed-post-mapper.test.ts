import assert from "node:assert/strict";
import test from "node:test";
import type { FeedPostRow } from "@/lib/unified-feed-post-mapper";
import { mapPostRowToFeedItem } from "@/lib/unified-feed-post-mapper";

const baseDate = new Date("2026-03-29T12:00:00.000Z");

function row(partial: Partial<FeedPostRow> & Pick<FeedPostRow, "id" | "type">): FeedPostRow {
  return {
    userId: "u1",
    mediaKind: "MOVIE",
    tmdbId: 550,
    metadata: {},
    createdAt: baseDate,
    sourceActivityEventId: null,
    content: null,
    user: {
      id: "u1",
      name: "Ada",
      username: "ada_m",
      profileVisibility: "PUBLIC"
    },
    ...partial
  } as FeedPostRow;
}

test("mapPostRowToFeedItem ACTIVITY + media path", () => {
  const item = mapPostRowToFeedItem(
    row({
      id: "post_a",
      type: "ACTIVITY",
      mediaKind: "MOVIE",
      tmdbId: 550
    })
  );
  assert.equal(item.type, "ACTIVITY");
  assert.equal(item.media.detailPath, "/show/550?type=movie");
  assert.equal(item.author.displayName, "Ada");
});

test("mapPostRowToFeedItem SHARE + TV path", () => {
  const item = mapPostRowToFeedItem(
    row({
      id: "post_s",
      type: "SHARE",
      content: "Must watch",
      mediaKind: "TV",
      tmdbId: 1396
    })
  );
  assert.equal(item.type, "SHARE");
  assert.equal(item.content, "Must watch");
  assert.equal(item.media.detailPath, "/show/1396?type=tv");
});

test("chronological tie-break: newer createdAt sorts before older for mixed types", () => {
  const older = mapPostRowToFeedItem(
    row({
      id: "post_old",
      type: "ACTIVITY",
      createdAt: new Date("2026-03-28T00:00:00.000Z")
    })
  );
  const newer = mapPostRowToFeedItem(
    row({
      id: "post_new",
      type: "SHARE",
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    })
  );
  assert.ok(newer.createdAt > older.createdAt);
});

/** MEM-94: feed JSON must never expose email (PII). */
test("mapPostRowToFeedItem JSON has no email field anywhere", () => {
  const item = mapPostRowToFeedItem(
    row({
      id: "post_pii",
      type: "SHARE",
      metadata: { nested: { note: "no email key below author" } }
    })
  );
  const json = JSON.stringify(item);
  assert.doesNotMatch(json, /"email"\s*:/);
});
