import assert from "node:assert/strict";
import test from "node:test";
import {
  POST_COMMENT_MAX_LENGTH,
  parsePostCommentContent
} from "@/lib/post-comment-content";

test("parsePostCommentContent accepts trimmed string", () => {
  const r = parsePostCommentContent("  hello  ");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.content, "hello");
});

test("parsePostCommentContent rejects empty", () => {
  assert.equal(parsePostCommentContent("   ").ok, false);
  assert.equal(parsePostCommentContent(null).ok, false);
});

test("parsePostCommentContent rejects over max", () => {
  const r = parsePostCommentContent("x".repeat(POST_COMMENT_MAX_LENGTH + 1));
  assert.equal(r.ok, false);
});
