# Where to Watch (TMDB) — operators & QA (MEM-103)

Internal reference for the **Where to Watch** feature (epic [MEM-95](https://linear.app/memed-test/issue/MEM-95)).

## TMDB endpoints

Server-side `tmdbFetch` calls (no extra public API route):

| Media | TMDB v3 path |
|--------|----------------|
| Movie | `GET /movie/{movie_id}/watch/providers` |
| TV | `GET /tv/{tv_id}/watch/providers` |

Docs: [Movie watch providers](https://developer.themoviedb.org/reference/movie-watch-providers), [TV watch providers](https://developer.themoviedb.org/reference/tv-series-watch-providers).

Response shape: `results` is an object keyed by **ISO 3166-1 alpha-2** region. Each region may include `flatrate` (subscription), `rent`, `buy`, and optional `link` (aggregate “more options” URL).

## Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `TMDB_API_KEY` | Yes | Same key as search/detail. |
| `WATCH_PROVIDERS_REGION` | No | Server-only (see [MEM-96](https://linear.app/memed-test/issue/MEM-96)). **Default `GB`** if unset, empty, or not two letters. Implemented in `src/lib/watch-providers-region.ts`. |

There is **no** env var for cache TTL; it is defined in code (below).

## Caching & deduplication

| Mechanism | Location | Value |
|-----------|----------|--------|
| Next.js fetch revalidate | `src/lib/watch-providers-load.ts` | **86400** seconds (24h) on the watch/providers `tmdbFetch` call. |
| Per-request dedupe | Same file | React `cache()` wraps `loadWhereToWatch(mediaType, tmdbId)`. |

Provider data is **not** stored in Postgres.

## UI surface

- **Page:** `/show/[id]` with `?type=movie` or `?type=tv` (`src/app/show/[id]/page.tsx`).
- **Component:** `src/components/where-to-watch-section.tsx` (async server section + `WhereToWatchSkeleton` inside `Suspense`).

## Manual smoke checklist

Run `npm run dev`, valid `TMDB_API_KEY` in `.env`, unless testing error handling.

1. **Movie with providers (GB default)**  
   Open `/show/550?type=movie` (Fight Club).  
   **Expect:** “Where to Watch” section with subscription/rent/buy groups and/or “More watch options”, **or** empty copy if TMDB has no rows for `GB` for this title.

2. **TV with providers**  
   Open `/show/1396?type=tv` (Breaking Bad).  
   **Expect:** Same section behaviour as (1) for TV.

3. **Empty state (likely)**  
   In `.env`, set `WATCH_PROVIDERS_REGION=BT` (or another region TMDB often omits for US-heavy titles). Restart dev server. Open `/show/550?type=movie`.  
   **Expect:** “No streaming options available for your region.” (no crash).  
   Remove or reset `WATCH_PROVIDERS_REGION` after the check.

4. **Error state (optional)**  
   Temporarily set `TMDB_API_KEY` to an invalid value (e.g. `invalid`). Restart dev server. Open any show URL above.  
   **Expect:** “Couldn’t load watch options. Try again later.”  
   Restore a valid key afterwards.

5. **Loading**  
   Throttle network (DevTools) and reload a detail page.  
   **Expect:** Skeleton in the Where to Watch slot before content appears.
