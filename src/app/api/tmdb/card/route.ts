import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

/**
 * GET /api/tmdb/card — poster + title for feed cards (MEM-91). Server-side TMDB only.
 *
 * Query: `kind=MOVIE|TV`, `tmdbId` (positive int).
 */
export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind")?.toUpperCase() ?? "";
  const idRaw =
    request.nextUrl.searchParams.get("tmdbId") ??
    request.nextUrl.searchParams.get("id") ??
    "";
  const tmdbId = Number(idRaw);

  if (kind !== "MOVIE" && kind !== "TV") {
    return NextResponse.json(
      { ok: false, error: "kind must be MOVIE or TV" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json(
      { ok: false, error: "tmdbId must be a positive integer" },
      { status: 400 }
    );
  }

  try {
    if (kind === "MOVIE") {
      const d = await tmdbFetch<{
        title?: string;
        poster_path?: string | null;
      }>(`/movie/${tmdbId}`, { language: "en-US" });
      return NextResponse.json({
        ok: true,
        title: d.title?.trim() || "Untitled",
        posterPath: d.poster_path ?? null
      });
    }
    const d = await tmdbFetch<{
      name?: string;
      poster_path?: string | null;
    }>(`/tv/${tmdbId}`, { language: "en-US" });
    return NextResponse.json({
      ok: true,
      title: d.name?.trim() || "Untitled",
      posterPath: d.poster_path ?? null
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not load title from TMDB." },
      { status: 502 }
    );
  }
}
