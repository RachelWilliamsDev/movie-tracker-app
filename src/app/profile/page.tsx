import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { ProfileHeaderFollow } from "@/components/profile-header-follow";
import { resolveUserActivityAccess } from "@/lib/activity-visibility";
import { authOptions } from "@/lib/auth";
import { countFollowers, countFollowing, getFollowState } from "@/lib/follow-service";
import { prisma } from "@/lib/prisma";
import { tmdbFetch } from "@/lib/tmdb";
import { WATCH_SOURCE_LABEL } from "@/lib/watch-source";
import { WATCH_STATUS_LABEL } from "@/lib/watch-status";

type TmdbMovieDetail = { title: string };
type TmdbTvDetail = { name: string };

type PageProps = {
  searchParams: Promise<{ userId?: string }>;
};

export default async function ProfilePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  // Logged out: show prompt only; do not attempt to render profile data.
  if (!user?.id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-8">
        <Link className="text-sm text-gray-600 underline" href="/">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-gray-600">
          Sign in to view your profile.
        </p>
      </main>
    );
  }

  const sp = await searchParams;
  const requestedId = sp.userId?.trim();
  const viewerId = user.id;
  const targetUserId = requestedId && requestedId.length > 0 ? requestedId : viewerId;

  const profileUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true }
  });
  if (!profileUser) {
    notFound();
  }

  const access = await resolveUserActivityAccess(viewerId, targetUserId);
  const displayName = profileUser.name?.trim() || profileUser.email || "User";
  const isOwnProfile = viewerId === targetUserId;

  const { followersCount, followingCount, initialIsFollowing } = isOwnProfile
    ? {
        followersCount: await countFollowers(targetUserId),
        followingCount: await countFollowing(targetUserId),
        initialIsFollowing: false
      }
    : await getFollowState(viewerId, targetUserId).then((s) => ({
        followersCount: s.followersCount,
        followingCount: s.followingCount,
        initialIsFollowing: s.isFollowing
      }));

  const [watched, ratings, tvProgressRows] = access.allowed
    ? await Promise.all([
        prisma.userWatch.findMany({
          where: { userId: targetUserId },
          orderBy: { createdAt: "desc" },
          take: 20
        }),
        prisma.userRating.findMany({
          where: { userId: targetUserId },
          orderBy: { createdAt: "desc" },
          take: 20
        }),
        prisma.userTvEpisodeProgress.findMany({
          where: {
            userId: targetUserId,
            mediaType: "tv",
            seasonNumber: { in: [1, 2] }
          }
        })
      ])
    : [[], [], []];

  /** Distinct TV shows (max 20), ordered by most recently updated progress among seasons 1–2. */
  const tvProgressByShow = new Map<
    number,
    { seasons: Map<number, number>; lastUpdated: Date }
  >();
  for (const row of tvProgressRows) {
    let entry = tvProgressByShow.get(row.contentId);
    if (!entry) {
      entry = { seasons: new Map(), lastUpdated: row.updatedAt };
      tvProgressByShow.set(row.contentId, entry);
    }
    entry.seasons.set(row.seasonNumber, row.episodeNumber);
    if (row.updatedAt > entry.lastUpdated) {
      entry.lastUpdated = row.updatedAt;
    }
  }
  const tvProgressShowIds = [...tvProgressByShow.entries()]
    .sort((a, b) => b[1].lastUpdated.getTime() - a[1].lastUpdated.getTime())
    .slice(0, 20)
    .map(([contentId]) => contentId);

  const tvProgressWithTitles = await Promise.all(
    tvProgressShowIds.map(async (contentId) => {
      const entry = tvProgressByShow.get(contentId);
      if (!entry) {
        return null;
      }
      try {
        const data = await tmdbFetch<TmdbTvDetail>(
          `/tv/${contentId}`,
          { language: "en-US" },
          { revalidate: 3600 }
        );
        return { contentId, title: data.name, seasons: entry.seasons };
      } catch {
        return null;
      }
    })
  );

  const resolvedTvProgress = tvProgressWithTitles.filter(
    (p): p is NonNullable<(typeof tvProgressWithTitles)[number]> => p != null
  );

  const ratingsWithTitles = await Promise.all(
    ratings.map(async (row) => {
      try {
        if (row.mediaType === "movie") {
          const data = await tmdbFetch<TmdbMovieDetail>(
            `/movie/${row.contentId}`,
            { language: "en-US" },
            { revalidate: 3600 }
          );
          return { ...row, title: data.title };
        }
        const data = await tmdbFetch<TmdbTvDetail>(
          `/tv/${row.contentId}`,
          { language: "en-US" },
          { revalidate: 3600 }
        );
        return { ...row, title: data.name };
      } catch {
        return null;
      }
    })
  );

  const resolvedRatings = ratingsWithTitles.filter(
    (r): r is (typeof ratingsWithTitles)[number] & { title: string } => r != null
  );

  const watchedWithTitles = await Promise.all(
    watched.map(async (watch) => {
      try {
        if (watch.mediaType === "movie") {
          const data = await tmdbFetch<TmdbMovieDetail>(
            `/movie/${watch.contentId}`,
            { language: "en-US" },
            { revalidate: 3600 }
          );
          return { ...watch, title: data.title };
        }
        const data = await tmdbFetch<TmdbTvDetail>(
          `/tv/${watch.contentId}`,
          { language: "en-US" },
          { revalidate: 3600 }
        );
        return { ...watch, title: data.name };
      } catch {
        // Keep the MVP simple: skip items we can't resolve from TMDB.
        return null;
      }
    })
  );

  const resolvedWatched = watchedWithTitles.filter(
    (w): w is (typeof watchedWithTitles)[number] & { title: string } => w != null
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-8">
      <Link className="text-sm text-gray-600 underline" href="/">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold">
        {isOwnProfile ? "Your profile" : "Profile"}
      </h1>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <ProfileHeaderFollow
          key={targetUserId}
          displayName={displayName}
          initialFollowersCount={followersCount}
          initialFollowingCount={followingCount}
          initialIsFollowing={initialIsFollowing}
          isOwnProfile={isOwnProfile}
          memberLabel={isOwnProfile ? "Signed in as" : "Member"}
          targetUserId={targetUserId}
        />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-base font-medium text-gray-900">Ratings</h2>

        {resolvedRatings.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No ratings yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {resolvedRatings.map((row, idx) => (
              <li key={`rating-${row.mediaType}-${row.contentId}-${idx}`}>
                <p className="text-sm font-medium text-gray-900">
                  {row.title}{" "}
                  <span className="text-gray-500">({row.mediaType})</span>
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Rating: {row.rating}/5
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-base font-medium text-gray-900">TV progress</h2>

        {resolvedTvProgress.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No TV progress yet.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {resolvedTvProgress.map((show) => (
              <li key={`tv-progress-${show.contentId}`}>
                <p className="text-sm font-medium text-gray-900">{show.title}</p>
                <ul className="mt-1 space-y-1">
                  {([1, 2] as const).map((seasonNum) => {
                    const ep = show.seasons.get(seasonNum);
                    if (ep == null) {
                      return null;
                    }
                    return (
                      <li key={`${show.contentId}-s${seasonNum}`} className="text-sm text-gray-600">
                        Season {seasonNum}: Episode {ep}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-base font-medium text-gray-900">Watch list</h2>

        {resolvedWatched.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No titles in your list yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {resolvedWatched.map((watch, idx) => {
              const statusLabel = WATCH_STATUS_LABEL[watch.watchStatus];
              const sourceSuffix =
                watch.watchStatus === "COMPLETED" && watch.watchSource != null
                  ? ` · ${WATCH_SOURCE_LABEL[watch.watchSource]}`
                  : "";

              return (
                <li key={`${watch.mediaType}-${watch.contentId}-${idx}`}>
                  <p className="text-sm font-medium text-gray-900">
                    {watch.title} <span className="text-gray-500">({watch.mediaType})</span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Status: {statusLabel}
                    {sourceSuffix}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

