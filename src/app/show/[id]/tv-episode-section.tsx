import { notFound } from "next/navigation";
import { EpisodeProgressPanel } from "@/components/episode-progress-panel";
import { prisma } from "@/lib/prisma";
import { tmdbFetch } from "@/lib/tmdb";

type TmdbSeasonDetail = {
  episodes: Array<{
    episode_number: number;
    name: string;
  }>;
};

type Props = {
  numericId: number;
  seasonNumber: number;
  userId: string | null;
};

/** Fetches TMDB season + episode progress; wrapped in Suspense on the parent for loading UI. */
export async function TvEpisodeSection({ numericId, seasonNumber, userId }: Props) {
  const seasonProgress =
    userId != null
      ? await prisma.userTvEpisodeProgress.findUnique({
          where: {
            userId_contentId_mediaType_seasonNumber: {
              userId,
              contentId: numericId,
              mediaType: "tv",
              seasonNumber
            }
          }
        })
      : null;

  let seasonEpisodes: Array<{ episodeNumber: number; title: string }> = [];

  try {
    const season = await tmdbFetch<TmdbSeasonDetail>(
      `/tv/${numericId}/season/${seasonNumber}`,
      { language: "en-US" },
      { revalidate: 3600 }
    );
    seasonEpisodes = season.episodes.map((ep) => ({
      episodeNumber: ep.episode_number,
      title: ep.name
    }));
  } catch {
    notFound();
  }

  return (
    <EpisodeProgressPanel
      key={`${numericId}-tv-season-${seasonNumber}`}
      contentId={numericId}
      episodes={seasonEpisodes}
      isLoggedIn={userId != null}
      seasonNumber={seasonNumber}
      savedEpisodeNumber={seasonProgress?.episodeNumber ?? null}
    />
  );
}
