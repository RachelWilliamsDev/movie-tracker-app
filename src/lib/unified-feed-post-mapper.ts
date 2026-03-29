import type { PostType, PostMediaKind, Prisma } from "@prisma/client";
import { userSocialDisplayName } from "@/lib/user-search";
import { showDetailPathForTmdb } from "@/lib/show-detail-path";

const authorSelect = {
  id: true,
  name: true,
  username: true,
  profileVisibility: true
} as const;

export type FeedPostAuthorSelect = typeof authorSelect;

export type FeedPostRow = Prisma.PostGetPayload<{
  include: { user: { select: typeof authorSelect } };
}>;

export type UnifiedFeedPostItem = {
  id: string;
  type: PostType;
  content: string | null;
  metadata: unknown;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    displayName: string;
  };
  media: {
    kind: PostMediaKind;
    tmdbId: number;
    detailPath: string;
  };
};

export function mapPostRowToFeedItem(row: FeedPostRow): UnifiedFeedPostItem {
  const displayName = userSocialDisplayName(row.user);
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.user.id,
      username: row.user.username,
      displayName
    },
    media: {
      kind: row.mediaKind,
      tmdbId: row.tmdbId,
      detailPath: showDetailPathForTmdb(row.mediaKind, row.tmdbId)
    }
  };
}

export { authorSelect };
