# Post likes API (MEM-87)

## Data model

- `PostLike`: one row per **(userId, postId)** — enforced with a **unique** constraint.
- **`likeCount`** for a post is always `COUNT(*)` of `PostLike` rows for that `postId` (no separate counter column).

## POST `/api/posts/[postId]/like` — toggle

Flips whether the **current user** likes the post (insert row ↔ delete row).

### Auth

- **401** if not signed in (`code`: `UNAUTHORIZED`).

### Errors

- **404** if the post does not exist (`code`: `NOT_FOUND`).

### Success `200`

```json
{
  "ok": true,
  "liked": true,
  "likeCount": 42
}
```

- **`liked`:** Whether the viewer has a like row **after** this operation.
- **`likeCount`:** Total likes on the post **after** the operation (full table count).

### Idempotency / duplicate likes

- **Cannot** insert two likes for the same user+post: the database rejects duplicates (`P2002`). A concurrent second `INSERT` is treated as “already liked.”
- Calling toggle twice in a row returns to the previous state (classic on/off).

### Unlike

- Implemented as **delete** of the viewer’s `PostLike` row. Idempotent in the sense that toggling when not liked inserts, when liked removes.

### Concurrency / correct counts

- **Source of truth:** rows in `PostLike`. After each toggle, `likeCount` is recomputed with `COUNT(*)` — no cached counter to drift.
- **Races:** Two simultaneous toggles from the **same** user may interleave; the final `liked` / `likeCount` reflect the last completed read-after-write. Two users liking at once both insert distinct rows; both succeed.
- **Transactions:** MVP uses sequential Prisma calls (no `SELECT FOR UPDATE` on `Post`). For very high contention, a future improvement would wrap toggle in a short transaction or use advisory locks.

---

## POST `/api/posts/likes/summary` — batch (feed)

Returns **`likeCount`** and **`viewerHasLiked`** for up to **50 distinct** post ids in **two** aggregate queries (avoid N+1 when rendering a feed page).

### Auth

- **401** if not signed in.

### Body

```json
{ "postIds": ["clx…", "clx…"] }
```

- Strings are trimmed; empty strings dropped.
- Duplicates are deduped before the limit check.
- More than **50** distinct ids → **400** (`code`: `BAD_REQUEST`).

### Success `200`

```json
{
  "ok": true,
  "posts": {
    "clx…": { "likeCount": 3, "viewerHasLiked": true }
  }
}
```

Only **existing** posts appear in `posts` (unknown ids are omitted).
