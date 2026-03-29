/** MEM-88: matches DB `VARCHAR(2000)`. */
export const POST_COMMENT_MAX_LENGTH = 2000;

export type ParsedPostCommentContent =
  | { ok: true; content: string }
  | { ok: false; error: string };

/**
 * Validates comment body for create API: trim, non-empty, max length (UTF-16 code units, MVP).
 */
export function parsePostCommentContent(raw: unknown): ParsedPostCommentContent {
  if (raw == null) {
    return { ok: false, error: "content is required" };
  }
  const s = String(raw).trim();
  if (s.length === 0) {
    return { ok: false, error: "content must not be empty" };
  }
  if (s.length > POST_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      error: `content must be at most ${POST_COMMENT_MAX_LENGTH} characters`
    };
  }
  return { ok: true, content: s };
}
