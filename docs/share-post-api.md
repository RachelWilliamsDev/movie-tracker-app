# Create share post API (MEM-89)

## `POST /api/posts/share`

Authenticated user creates a **`Post`** with `type = SHARE`, visible to followers via `GET /api/feed/posts` (MEM-86).

### Auth

- **401** `UNAUTHORIZED` if not signed in.

### Request body (JSON)

| Field | Required | Description |
|-------|----------|-------------|
| `mediaKind` | yes | `MOVIE` or `TV` (also accepts `movie` / `tv`). |
| `tmdbId` | yes | Positive integer TMDB id for the title. |
| `content` | no | Optional caption; trimmed; empty → stored as `null`. Max **2000** characters (plain text). |
| `rating` | no | Integer **1–5**. **Only allowed** if the user has **no** existing `UserRating` for the same `tmdbId` + media type. |

TMDB validation (MVP): numeric shape only; no live TMDB fetch.

### Success **201**

```json
{
  "ok": true,
  "post": {
    "id": "clx…",
    "type": "SHARE",
    "content": "optional caption",
    "mediaKind": "MOVIE",
    "tmdbId": 550,
    "metadata": {
      "share": true,
      "mediaType": "movie",
      "rating": 5,
      "watchStatus": "COMPLETED"
    },
    "createdAt": "2026-03-29T16:00:00.000Z"
  }
}
```

- `metadata` always includes `share: true` and `mediaType` (`movie` | `tv`).
- `rating` appears only when the request included a rating (and a new `UserRating` row was created).
- `watchStatus` is included when the user has a `UserWatch` row for that title (snapshot at post time).

When a **new** rating is applied, a best-effort **`RATED`** `UserActivityEvent` is scheduled (same pattern as `POST /api/rating`), so the legacy activity feed stays consistent.

### Errors

| Status | `code` | When |
|--------|--------|------|
| 400 | `SHARE_POST_INVALID_MEDIA` | Bad `mediaKind` / `tmdbId` |
| 400 | `BAD_REQUEST` | Malformed JSON object, bad `content` / `rating` shape |
| 400 | `SHARE_POST_ALREADY_RATED` | `rating` present but `UserRating` already exists (or race → unique violation) |
| 429 | `SHARE_POST_THROTTLED` | More than **120** `SHARE` posts in the last **rolling hour** for this user |
| 500 | `SHARE_POST_FAILED` | Unexpected failure |

### Unified feed

`GET /api/feed/posts` loads all `Post` rows for followed users (any `type`), so new **`SHARE`** posts appear in chronological order with **`ACTIVITY`** posts.

### Throttle (MVP)

The hourly cap is enforced with a `COUNT` on `Post` (`type = SHARE`, `userId`, `createdAt` window). It is **not** a hard global rate limiter (e.g. Redis); good enough for basic abuse reduction on a single DB.

### XSS

Treat `content` like comments: store plain text; clients must render as text, not HTML (`docs/post-comments-api.md`).
