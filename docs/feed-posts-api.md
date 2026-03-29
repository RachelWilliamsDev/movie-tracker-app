# Unified posts feed API (MEM-86)

## Endpoint

`GET /api/feed/posts`

- **Auth:** Signed-in session (NextAuth cookie). **401** `{ "error": "Unauthorized" }` if missing.
- **Scope:** `Post` rows whose `userId` is in the viewer’s **approved** follow list (`UserFollow.approvalStatus = APPROVED`) **or** is the viewer themselves (so your own shares/activity appear on `/feed`).
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

## Profile: one user’s posts

`GET /api/users/[userId]/posts`

- **Auth:** Optional. Same **visibility** rules as profile activity (`resolveUserActivityAccess`): public profiles readable when signed out; private profiles require an approved follow (or owner).
- **403** if the viewer may not see that member’s activity.
- **404** if the user id is unknown.
- **Query / response shape:** Same as `GET /api/feed/posts` (`limit`, `cursor`, `offset`, `items`, `pagination`).

Used by the profile page **Recent activity** tab (`/user/[username]`, `/profile/[userId]`, and your own `/profile`).

## MEM-94 — Integration (PII, payload size, QA)

### PII

- **Author** is built only from `id`, `name`, `username`, and internal `profileVisibility` (filtered out before JSON). **`email` is never selected** from `User` for this endpoint; responses must not contain an `"email"` JSON key.

### Payload size (slow networks)

- Default **`limit` 20**, max **50** per request. The feed page uses **`limit=20`** and batches like summaries (see `LIKE_SUMMARY_MAX_IDS` on the client). Prefer **cursor** pagination over large offsets.
- For very slow links, clients may call with a smaller `limit` (e.g. `10`).

### Automated smoke

- Playwright: `e2e/feed-posts-integration.spec.ts` — signed-in session, `GET /api/feed/posts`, asserts **200**, **`ok`**, and response body has **no `"email"`** key; bounds response size for `limit=10`.
- Run: `npm run test:e2e` (after `prisma db seed` and `.env` like other e2e tests).

### Manual QA path (quick)

1. Sign in as user **A**. Sign in as user **B** in another browser (or incognito); **B follows A** (approved).
2. As **A**, create a share or activity that produces a **feed post** (or use seed/backfill data).
3. As **B**, open **`/feed`** — confirm **A**’s post appears; open **`/show/...`** from the card; **like** / **comment** if UI is available.
4. DevTools → Network → select **`/api/feed/posts`** → confirm response JSON has **no `email`** fields.
