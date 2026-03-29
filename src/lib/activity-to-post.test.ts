import assert from "node:assert/strict";
import test from "node:test";
import { mapUserActivityEventToPost } from "@/lib/activity-to-post";

const baseDate = new Date("2026-01-15T12:00:00.000Z");

test("mapUserActivityEventToPost maps WATCH_COMPLETED", () => {
  const r = mapUserActivityEventToPost({
    id: "evt_1",
    actorId: "user_a",
    type: "WATCH_COMPLETED",
    metadata: { contentId: 550, mediaType: "movie", watchSource: "NETFLIX" },
    createdAt: baseDate
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.userId, "user_a");
  assert.equal(r.data.type, "ACTIVITY");
  assert.equal(r.data.mediaKind, "MOVIE");
  assert.equal(r.data.tmdbId, 550);
  assert.equal(r.data.content, null);
  assert.equal(r.data.sourceActivityEventId, "evt_1");
  assert.equal(r.data.createdAt.getTime(), baseDate.getTime());
  const m = r.data.metadata as Record<string, unknown>;
  assert.equal(m.activityType, "WATCH_COMPLETED");
  assert.equal(m.watchSource, "NETFLIX");
});

test("mapUserActivityEventToPost maps RATED tv", () => {
  const r = mapUserActivityEventToPost({
    id: "evt_2",
    actorId: "user_b",
    type: "RATED",
    metadata: { contentId: 42, mediaType: "tv", rating: 4 },
    createdAt: baseDate
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.mediaKind, "TV");
  assert.equal(r.data.tmdbId, 42);
  const m = r.data.metadata as Record<string, unknown>;
  assert.equal(m.activityType, "RATED");
  assert.equal(m.rating, 4);
});

test("mapUserActivityEventToPost rejects invalid metadata", () => {
  assert.equal(
    mapUserActivityEventToPost({
      id: "e",
      actorId: "u",
      type: "WATCH_COMPLETED",
      metadata: {},
      createdAt: baseDate
    }).ok,
    false
  );
  assert.equal(
    mapUserActivityEventToPost({
      id: "e",
      actorId: "u",
      type: "RATED",
      metadata: { contentId: 1, mediaType: "podcast" },
      createdAt: baseDate
    }).ok,
    false
  );
});
