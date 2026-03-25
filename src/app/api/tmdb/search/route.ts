import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

type TmdbSearchItem = {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
};

type TmdbSearchResponse = {
  page: number;
  results: TmdbSearchItem[];
  total_pages: number;
  total_results: number;
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const payload = await tmdbFetch<TmdbSearchResponse>("/search/multi", {
      query,
      include_adult: "false",
      language: "en-US",
      page: 1
    });

    const results = payload.results
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .map((item) => ({
        id: item.id,
        mediaType: item.media_type,
        title: item.title ?? item.name ?? "Untitled",
        releaseYear: (item.release_date ?? item.first_air_date ?? "").slice(0, 4) || null,
        posterPath: item.poster_path ?? null
      }));

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
