/** Shared keyset pagination for Post feeds (MEM-86 / profile posts). */

export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;

export type FeedCursorPayload = { t: string; i: string };

export function parseFeedLimit(raw: string | null): number {
  if (raw == null || raw === "") {
    return FEED_DEFAULT_LIMIT;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return FEED_DEFAULT_LIMIT;
  }
  return Math.min(n, FEED_MAX_LIMIT);
}

export function encodeFeedCursor(payload: FeedCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeFeedCursor(raw: string): FeedCursorPayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const v = JSON.parse(json) as unknown;
    if (
      v != null &&
      typeof v === "object" &&
      "t" in v &&
      "i" in v &&
      typeof (v as FeedCursorPayload).t === "string" &&
      typeof (v as FeedCursorPayload).i === "string"
    ) {
      return v as FeedCursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}
