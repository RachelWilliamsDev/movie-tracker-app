import type { PostMediaKind } from "@prisma/client";

/**
 * Canonical detail URL for TMDB-backed titles on the show page (MEM-86 / FE feed deep links).
 */
export function showDetailPathForTmdb(mediaKind: PostMediaKind, tmdbId: number): string {
  const id = String(tmdbId);
  if (mediaKind === "TV") {
    return `/show/${id}?type=tv`;
  }
  return `/show/${id}?type=movie`;
}
