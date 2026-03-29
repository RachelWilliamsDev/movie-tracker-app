# Unified posts feed API (MEM-86)

## Endpoint

`GET /api/feed/posts`

- **Auth:** Signed-in session (NextAuth cookie). **401** `{ "error": "Unauthorized" }` if missing.
- **Scope:** `Post` rows whose `userId` is in the viewer’s **approved** follow list (`UserFollow.approvalStatus = APPROVED`), same idea as `GET /api/activity/feed`.
- **Privacy:** Posts from authors with `PRIVATE` profiles are only included when policy allows (aligned with `canViewUserActivityFromPolicy` — in practice, approved follows satisfy this for followed authors).

## Query parameters

| Param    | Description |
|----------|-------------|
| `limit`  | Optional. Default `20`, max `50`. |
| `cursor` | Optional. Opaque string from `pagination.nextCursor`. Keyset pagination on `(createdAt DESC, id DESC)`. Mutually exclusive style with offset matches activity feed: prefer cursor for stable paging. |
| `offset` | Optional. Non-negative integer; only used when `cursor` is omitted. |

Invalid `cursor` → **400** `{ "error": "Invalid cursor" }`.  
Invalid `offset` → **400** `{ "error": "offset must be a non-negative integer" }`.

## Success response

```json
{
  "ok": true,
  "items": [
    {
      "id": "clx…",
      "type": "ACTIVITY",
      "content": null,
      "metadata": {},
      "createdAt": "2026-03-29T12:00:00.000Z",
      "author": {
        "id": "…",
        "username": "handle",
        "displayName": "Display Name"
      },
      "media": {
        "kind": "MOVIE",
        "tmdbId": 550,
        "detailPath": "/show/550?type=movie"
      }
    }
  ],
  "pagination": {
    "limit": 20,
    "hasMore": false,
    "nextCursor": null,
    "nextOffset": null
  }
}
```

### Frontend usage (rich card + deep link)

- **Author:** `author.id`, `author.username`, `author.displayName` — display rules match FEAT-136 (`userSocialDisplayName`: name → username → `"Member"`; never email).
- **TMDB card:** `media.kind` (`MOVIE` | `TV`) and `media.tmdbId` for poster/title fetch (client-side TMDB or future API enrichment).
- **Detail navigation:** `media.detailPath` — canonical show page URLs: `/show/<tmdbId>?type=movie` or `?type=tv` (see `src/app/show/[id]/page.tsx`).
- **Copy / activity payload:** `metadata` JSON (e.g. `activityType` on activity-backed posts). `content` is the optional share text for `SHARE` posts.

## Ordering

Posts are returned in a **single chronological stream**, newest first, with **no separation** by `type`: `ACTIVITY` and `SHARE` interleave by `createdAt` (tie-break `id`).

## Indexes

Prisma schema includes `@@index([userId, createdAt(sort: Desc)])` on `Post` for this access pattern.

## Verifying mixed `ACTIVITY` + `SHARE` with seed data

1. Ensure followed authors have posts: run `npm run posts:backfill-activity` so `Post` rows exist from `UserActivityEvent`.
2. Insert at least one **`SHARE`** row for a user your test viewer follows (e.g. Prisma Studio or a one-off script). Example shape:
   - `type = SHARE`
   - `userId` = followed user
   - `mediaKind`, `tmdbId`, `metadata`, `createdAt` set; `content` optional string
3. Call `GET /api/feed/posts` as the viewer: response `items` should list both types ordered by `createdAt` descending.

Unit coverage: `src/lib/unified-feed-post-mapper.test.ts` (mapping + paths); ordering is enforced by the Prisma `orderBy` in `src/app/api/feed/posts/route.ts`.
