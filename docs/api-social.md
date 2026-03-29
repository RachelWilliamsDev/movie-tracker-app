# Social follow list APIs

Contract for list endpoints used by the web app and external/mobile clients. Shape updated for **FEAT-134** (nullable `username` on user rows) and **FEAT-136** (social display rules). Related QA: [MEM-72](https://linear.app/memed-test/issue/MEM-72), [MEM-74](https://linear.app/memed-test/issue/MEM-74). This doc: [MEM-81](https://linear.app/memed-test/issue/MEM-81/docs-followersfollowing-api-response-displayname-nullable-username).

## Shared list item fields

Each entry in `followers` or `following` is an object with:

| Field | Type | Description |
|--------|------|-------------|
| `userId` | `string` | Target user’s stable id (CUID). |
| `username` | `string \| null` | Canonical handle when set; `null` until the user completes username onboarding (FEAT-134). |
| `displayName` | `string` | Label for UI lists. Derived via `userSocialDisplayName` — **never the user’s email** on social surfaces (FEAT-136). Falls back to `username`, then `"Member"`. |
| `avatarUrl` | `string \| null` | Reserved; currently always `null` (MVP). |
| `followedAt` | `string` | ISO-8601 timestamp when the follow row was created (`UserFollow.createdAt`). |

## `GET /api/follow/followers`

**Query**

- `userId` (required) — whose follower list to return.
- `limit` (optional) — page size; default `20`, max `50`.
- `cursor` (optional) — opaque pagination cursor (`UserFollow.id` of the last item from the previous page).

**Success `200`** — JSON:

```json
{
  "ok": true,
  "followers": [
    {
      "userId": "…",
      "username": "ada_lovelace",
      "displayName": "Ada",
      "avatarUrl": null,
      "followedAt": "2026-03-29T12:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "hasMore": false,
    "nextCursor": null
  }
}
```

## `GET /api/follow/following`

Same query parameters and pagination shape as followers.

**Success `200`** — JSON:

```json
{
  "ok": true,
  "following": [ … same item shape as above … ],
  "pagination": {
    "limit": 20,
    "hasMore": false,
    "nextCursor": null
  }
}
```

## Errors

Both routes may return `{ "error": string, "code": string }` with non-2xx status (e.g. `400` missing `userId`, `404` unknown user, `500` list failures). Exact codes are defined in app code (`FOLLOWERS_LIST_FAILED`, `FOLLOWING_LIST_FAILED`, etc.).

## Implementation reference

- `src/app/api/follow/followers/route.ts`
- `src/app/api/follow/following/route.ts`
- `userSocialDisplayName` — `src/lib/user-search.ts`
