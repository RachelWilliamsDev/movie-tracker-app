import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { MarkWatchedButton } from "@/components/mark-watched-button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbFetch } from "@/lib/tmdb";

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

type TmdbGenre = { id: number; name: string };

type TmdbMovieDetail = {
  title: string;
  overview: string;
  poster_path: string | null;
  genres: TmdbGenre[];
};

type TmdbTvDetail = {
  name: string;
  overview: string;
  poster_path: string | null;
  genres: TmdbGenre[];
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
};

function isMediaType(value: string | undefined): value is "movie" | "tv" {
  return value === "movie" || value === "tv";
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const numericId = Number.parseInt(id, 10);
  const mediaType = isMediaType(sp.type) ? sp.type : "movie";

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { title: "Not found" };
  }

  try {
    if (mediaType === "movie") {
      const data = await tmdbFetch<TmdbMovieDetail>(
        `/movie/${numericId}`,
        { language: "en-US" },
        { revalidate: 3600 }
      );
      return { title: data.title };
    }
    const data = await tmdbFetch<TmdbTvDetail>(
      `/tv/${numericId}`,
      { language: "en-US" },
      { revalidate: 3600 }
    );
    return { title: data.name };
  } catch {
    return { title: "Show" };
  }
}

export default async function ShowDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const numericId = Number.parseInt(id, 10);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    notFound();
  }

  const mediaType = isMediaType(sp.type) ? sp.type : "movie";

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const existingWatch =
    userId != null
      ? await prisma.userWatch.findUnique({
          where: {
            userId_contentId_mediaType: {
              userId,
              contentId: numericId,
              mediaType
            }
          }
        })
      : null;

  let title: string;
  let overview: string;
  let posterPath: string | null;
  let genres: TmdbGenre[];

  try {
    if (mediaType === "movie") {
      const data = await tmdbFetch<TmdbMovieDetail>(
        `/movie/${numericId}`,
        { language: "en-US" },
        { revalidate: 3600 }
      );
      title = data.title;
      overview = data.overview;
      posterPath = data.poster_path;
      genres = data.genres ?? [];
    } else {
      const data = await tmdbFetch<TmdbTvDetail>(
        `/tv/${numericId}`,
        { language: "en-US" },
        { revalidate: 3600 }
      );
      title = data.name;
      overview = data.overview;
      posterPath = data.poster_path;
      genres = data.genres ?? [];
    }
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <Link className="text-sm text-gray-600 underline" href="/">
        ← Back
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row">
        {posterPath ? (
          <Image
            alt={title}
            className="w-full max-w-[220px] shrink-0 rounded-lg object-cover sm:max-w-[240px]"
            height={360}
            src={`${POSTER_BASE}${posterPath}`}
            unoptimized
            width={240}
          />
        ) : (
          <div className="flex h-64 w-full max-w-[240px] items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
            No poster
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold">{title}</h1>

          {genres.length > 0 ? (
            <p className="mt-2 text-sm text-gray-600">
              {genres.map((g) => g.name).join(" · ")}
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No genres listed.</p>
          )}

          <section className="mt-4">
            <h2 className="text-sm font-medium text-gray-500">Overview</h2>
            <p className="mt-1 whitespace-pre-wrap text-gray-800">
              {overview?.trim() ? overview : "No overview available."}
            </p>
          </section>

          <MarkWatchedButton
            contentId={numericId}
            initialWatched={!!existingWatch}
            isLoggedIn={!!userId}
            mediaType={mediaType}
          />
        </div>
      </div>
    </main>
  );
}
