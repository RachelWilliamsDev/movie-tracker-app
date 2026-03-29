import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "next-auth/next";
import { MarkWatchedButton } from "@/components/mark-watched-button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbFetch } from "@/lib/tmdb";
import { RatingPanel } from "@/components/rating-panel";
import { ShareToFeedModal } from "@/components/share-to-feed-modal";
import {
  WhereToWatchSection,
  WhereToWatchSkeleton
} from "@/components/where-to-watch-section";
import { TvEpisodeSection } from "./tv-episode-section";

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const PROFILE_BASE = "https://image.tmdb.org/t/p/w185";

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

type TmdbMovieCredits = {
  cast: Array<{
    name?: string;
    order?: number;
    profile_path?: string | null;
  }>;
};

type TmdbTvCredits = {
  cast: Array<{
    name?: string;
    order?: number;
    profile_path?: string | null;
  }>;
};

type TmdbCastEntry = {
  name: string;
  profile_path: string | null;
};

function getCastInitials(name: string): string {
  const parts = name.split(/\s+/).map((p) => p.trim()).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = (parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]) ?? "";
  return `${first}${second}`.toUpperCase();
}

/** First up to 3 cast entries: TMDB `order` ascending, skip empty names. */
function topCastEntries(
  cast: Array<{
    name?: string;
    order?: number;
    profile_path?: string | null;
  }>
): TmdbCastEntry[] {
  const sorted = [...cast].sort((a, b) => (a.order ?? 99999) - (b.order ?? 99999));
  const entries: TmdbCastEntry[] = [];
  for (const c of sorted) {
    const n = c.name?.trim();
    if (!n) continue;
    const p = (c.profile_path ?? null) ? String(c.profile_path) : null;
    entries.push({ name: n, profile_path: p });
    if (entries.length >= 3) break;
  }
  return entries;
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; season?: string }>;
};

function isMediaType(value: string | undefined): value is "movie" | "tv" {
  return value === "movie" || value === "tv";
}

/** TV `season` query: missing/blank → 1; invalid → null (caller should `notFound()`). */
function parseTvSeasonQueryParam(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") {
    return 1;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params;
  const sp = await props.searchParams;
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

export default async function ShowDetailPage(props: PageProps) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const numericId = Number.parseInt(id, 10);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    notFound();
  }

  const mediaType = isMediaType(sp.type) ? sp.type : "movie";

  let seasonNumber = 1;
  if (mediaType === "tv") {
    const parsed = parseTvSeasonQueryParam(sp.season);
    if (parsed === null) {
      notFound();
    }
    seasonNumber = parsed;
  }

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

  const userRating =
    userId != null
      ? await prisma.userRating.findUnique({
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
  let movieTopCast: TmdbCastEntry[] = [];
  let tvTopCast: TmdbCastEntry[] = [];

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
      try {
        const credits = await tmdbFetch<TmdbMovieCredits>(
          `/movie/${numericId}/credits`,
          {},
          { revalidate: 3600 }
        );
        movieTopCast = topCastEntries(credits.cast ?? []);
      } catch {
        movieTopCast = [];
      }
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

      try {
        const credits = await tmdbFetch<TmdbTvCredits>(
          `/tv/${numericId}/credits`,
          {},
          { revalidate: 3600 }
        );
        tvTopCast = topCastEntries(credits.cast ?? []);
      } catch {
        tvTopCast = [];
      }
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

          <Suspense fallback={<WhereToWatchSkeleton />}>
            <WhereToWatchSection mediaType={mediaType} tmdbId={numericId} />
          </Suspense>

          {mediaType === "movie" ? (
            <section className="mt-4">
              <h2 className="text-sm font-medium text-gray-500">Cast</h2>
              {movieTopCast.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm text-gray-800">
                  {movieTopCast.map((entry, index) => (
                    <li key={`${entry.name}-${index}`} className="flex items-center gap-2">
                      {entry.profile_path ? (
                        <Image
                          alt={entry.name}
                          className="h-10 w-10 rounded-full object-cover"
                          height={40}
                          src={`${PROFILE_BASE}${entry.profile_path}`}
                          unoptimized
                          width={40}
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-700">
                          {getCastInitials(entry.name)}
                        </div>
                      )}
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-gray-600">No cast listed.</p>
              )}
            </section>
          ) : null}

          {mediaType === "tv" ? (
            <section className="mt-4">
              <h2 className="text-sm font-medium text-gray-500">Cast</h2>
              {tvTopCast.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm text-gray-800">
                  {tvTopCast.map((entry, index) => (
                    <li key={`${entry.name}-${index}`} className="flex items-center gap-2">
                      {entry.profile_path ? (
                        <Image
                          alt={entry.name}
                          className="h-10 w-10 rounded-full object-cover"
                          height={40}
                          src={`${PROFILE_BASE}${entry.profile_path}`}
                          unoptimized
                          width={40}
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-700">
                          {getCastInitials(entry.name)}
                        </div>
                      )}
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-gray-600">No cast listed.</p>
              )}
            </section>
          ) : null}

          <RatingPanel
            contentId={numericId}
            initialRating={userRating?.rating ?? null}
            isLoggedIn={!!userId}
            mediaType={mediaType}
          />

          <MarkWatchedButton
            contentId={numericId}
            initialWatchSource={existingWatch?.watchSource ?? null}
            initialWatchStatus={existingWatch?.watchStatus ?? null}
            isLoggedIn={!!userId}
            mediaType={mediaType}
          />

          <ShareToFeedModal
            hasExistingRating={userRating != null}
            isLoggedIn={!!userId}
            mediaType={mediaType}
            title={title}
            tmdbId={numericId}
          />

          {mediaType === "tv" ? (
            <>
              <div className="mt-6 flex items-center gap-2">
                {[1, 2].map((n) => {
                  const href = `/show/${numericId}?type=tv&season=${n}`;
                  const active = n === seasonNumber;
                  return (
                    <Link
                      key={n}
                      href={href}
                      className={`rounded px-3 py-1 text-sm ${
                        active
                          ? "bg-black text-white"
                          : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Season {n}
                    </Link>
                  );
                })}
              </div>

              <Suspense
                fallback={
                  <p className="mt-6 text-sm text-gray-600" aria-live="polite">
                    Loading episodes…
                  </p>
                }
              >
                <TvEpisodeSection
                  numericId={numericId}
                  seasonNumber={seasonNumber}
                  userId={userId ?? null}
                />
              </Suspense>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
