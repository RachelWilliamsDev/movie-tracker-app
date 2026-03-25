import { NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

type TmdbMovie = {
  id: number;
  title: string;
  release_date?: string;
};

type TmdbPopularMoviesResponse = {
  page: number;
  results: TmdbMovie[];
  total_pages: number;
  total_results: number;
};

export async function GET() {
  try {
    const payload = await tmdbFetch<TmdbPopularMoviesResponse>("/movie/popular", {
      page: 1,
      language: "en-US"
    });

    const first = payload.results[0];

    return NextResponse.json({
      ok: true,
      sample: first
        ? {
            id: first.id,
            title: first.title,
            releaseDate: first.release_date ?? null
          }
        : null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown TMDB error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
