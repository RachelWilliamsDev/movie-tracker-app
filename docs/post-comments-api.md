# Post comments API (MEM-88)

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/posts/[postId]/comments` | Optional (none required for list) |
| `POST` | `/api/posts/[postId]/comments` | **Required** (session cookie) |

Unknown or empty `postId` / missing post row → **404** `{ "error": "Post not found.", "code": "NOT_FOUND" }`.

---

## `GET` — list comments

**Sort order:** **Oldest first** (`createdAt` ascending, then `id` ascending) for a stable reading order.

### Query parameters

| Param | Description |
|-------|-------------|
| `limit` | Optional. Default `50`, maximum `100`. |
| `cursor` | Optional. Opaque string from `pagination.nextCursor`. Keyset pagination: returns comments **after** the cursor item. |

Invalid `cursor` → **400** `{ "error": "Invalid cursor", "code": "BAD_REQUEST" }`.

### Success `200`

```json
{
  "ok": true,
  "comments": [
    {
      "id": "clx…",
      "userId": "…",
      "username": "handle",
      "displayName": "Display Name",
      "content": "Plain text body",
      "createdAt": "2026-03-29T12:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "hasMore": false,
    "nextCursor": null,
    "order": "oldest_first"
  }
}
```

- **`username`:** May be `null` for users who have not completed username onboarding (rare in production after FEAT-136).
- **`displayName`:** FEAT-136 rules via `userSocialDisplayName` (name → username → `"Member"`; never email).

---

## `POST` — create comment

### Body

```json
{ "content": "string" }
```

- Trimmed; must be **non-empty** and at most **2000** characters (JavaScript string length / UTF-16 code units, MVP).

### Errors

| Status | When |
|--------|------|
| **401** | Not signed in (`code`: `UNAUTHORIZED`) |
| **404** | Post does not exist |
| **400** | Invalid JSON, empty/too-long content (`code`: `BAD_REQUEST`) |

### Success `200`

```json
{
  "ok": true,
  "comment": {
    "id": "…",
    "userId": "…",
    "username": "…",
    "displayName": "…",
    "content": "…",
    "createdAt": "…"
  }
}
```

---

## XSS / sanitization policy

1. **Storage:** Comments are stored as **plain text** in Postgres (`VARCHAR(2000)`). We do **not** accept HTML, markdown, or rich text in v1.
2. **Transport:** JSON encodes strings safely for parsers; there is no HTML response wrapper.
3. **Rendering (FE):** Treat `content` as **text**, not HTML. In React, use default text children (e.g. `{comment.content}`) or a markdown layer **only** after a deliberate, audited choice — **do not** use `dangerouslySetInnerHTML` with raw API text.

Server-side HTML escaping is **not** applied to JSON fields; escaping is the **client’s responsibility** when building DOM (standard for JSON APIs).

---

## Database

- Model: `PostComment` — `id`, `postId`, `userId`, `content`, `createdAt`.
- Index: `(postId, createdAt)` for listing.
