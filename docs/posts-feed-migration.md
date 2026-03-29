# Post model and activity backfill (MEM-85)

## Mapping rules

`UserActivityEvent` rows are turned into `Post` rows when:

- `type` is `WATCH_COMPLETED` or `RATED`.
- `metadata.contentId` is a positive TMDB id (number or numeric string).
- `metadata.mediaType` is exactly `movie` or `tv` (lowercase, as written by watch/rating APIs).

Derived `Post` fields:

| Post field | Source |
|------------|--------|
| `userId` | `UserActivityEvent.actorId` |
| `type` | Always `ACTIVITY` for this backfill |
| `content` | `null` |
| `mediaKind` | `MOVIE` if `mediaType === "movie"`, else `TV` |
| `tmdbId` | Parsed `contentId` |
| `metadata` | Original event `metadata` as JSON, then canonical `activityType` (`WATCH_COMPLETED` or `RATED`) so it always matches the event type. |
| `createdAt` | Same instant as the activity event |
| `sourceActivityEventId` | `UserActivityEvent.id` (unique; idempotency key) |

Events that fail validation are skipped by the backfill script (logged counts only).

## Ops

1. Deploy migration `20260329130000_add_post_model` (or run `npx prisma migrate deploy` in the target environment).
2. Run `npm run posts:backfill-activity` once per environment. Re-runs are safe.

## Rollback

- **Schema:** In an emergency, drop dependent data then the table:

  ```sql
  DROP TABLE IF EXISTS "Post";
  DROP TYPE IF EXISTS "PostMediaKind";
  DROP TYPE IF EXISTS "PostType";
  ```

  Remove the corresponding migration from deployment history only if you are resetting a dev database; production should use a forward migration or restore from backup.

- **Data only:** `TRUNCATE TABLE "Post" RESTART IDENTITY;` (IDs are text, so identity does not apply; truncate clears rows). Then re-run the backfill script if needed.

## Feed API

`GET /api/activity/feed` continues to read `UserActivityEvent` until a follow-up ticket switches the feed to `Post`.
