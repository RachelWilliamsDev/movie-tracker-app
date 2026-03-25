import type { WatchSource } from "@prisma/client";

/** Human-readable labels for detail UI (e.g. "Watched on Netflix"). */
export const WATCH_SOURCE_LABEL: Record<WatchSource, string> = {
  NETFLIX: "Netflix",
  DISNEY_PLUS: "Disney+",
  PRIME_VIDEO: "Prime Video",
  OTHER: "Other"
};

export const WATCH_SOURCE_ORDER: WatchSource[] = [
  "NETFLIX",
  "DISNEY_PLUS",
  "PRIME_VIDEO",
  "OTHER"
];
