import type { WatchStatus } from "@prisma/client";

/** Human-readable labels for UI (maps Prisma `WatchStatus` enum). */
export const WATCH_STATUS_LABEL: Record<WatchStatus, string> = {
  WATCHING: "Watching",
  COMPLETED: "Completed",
  WANT_TO_WATCH: "Want to Watch"
};
