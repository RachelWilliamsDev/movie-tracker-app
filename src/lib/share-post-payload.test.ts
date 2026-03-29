import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSharePostBody,
  SHARE_POST_CONTENT_MAX
} from "@/lib/share-post-payload";

test("parseSharePostBody minimal payload", () => {
  const r = parseSharePostBody({ mediaKind: "MOVIE", tmdbId: 550 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.mediaKind, "MOVIE");
  assert.equal(r.data.tmdbId, 550);
  assert.equal(r.data.content, null);
  assert.equal(r.data.rating, undefined);
});

test("parseSharePostBody tv + content + rating", () => {
  const r = parseSharePostBody({
    mediaKind: "tv",
    tmdbId: 1396,
    content: " Great ",
    rating: 5
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.mediaKind, "TV");
  assert.equal(r.data.content, "Great");
  assert.equal(r.data.rating, 5);
});

test("parseSharePostBody rejects invalid mediaKind", () => {
  const r = parseSharePostBody({ mediaKind: "podcast", tmdbId: 1 });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "SHARE_POST_INVALID_MEDIA");
});

test("parseSharePostBody rejects bad tmdbId", () => {
  assert.equal(parseSharePostBody({ mediaKind: "MOVIE", tmdbId: 0 }).ok, false);
  assert.equal(parseSharePostBody({ mediaKind: "MOVIE", tmdbId: -1 }).ok, false);
});

test("parseSharePostBody rejects long content", () => {
  const r = parseSharePostBody({
    mediaKind: "MOVIE",
    tmdbId: 1,
    content: "x".repeat(SHARE_POST_CONTENT_MAX + 1)
  });
  assert.equal(r.ok, false);
});

test("parseSharePostBody rejects rating out of range", () => {
  assert.equal(
    parseSharePostBody({ mediaKind: "MOVIE", tmdbId: 1, rating: 0 }).ok,
    false
  );
  assert.equal(
    parseSharePostBody({ mediaKind: "MOVIE", tmdbId: 1, rating: 6 }).ok,
    false
  );
});
