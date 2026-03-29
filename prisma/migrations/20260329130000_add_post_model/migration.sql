-- MEM-85: `Post` model for unified activity + future share feed; backfill via `npm run posts:backfill-activity`.

CREATE TYPE "PostType" AS ENUM ('ACTIVITY', 'SHARE');
CREATE TYPE "PostMediaKind" AS ENUM ('MOVIE', 'TV');

CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PostType" NOT NULL,
    "content" TEXT,
    "mediaKind" "PostMediaKind" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "sourceActivityEventId" TEXT,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Post_sourceActivityEventId_key" ON "Post"("sourceActivityEventId");

CREATE INDEX "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt" DESC);

ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_sourceActivityEventId_fkey" FOREIGN KEY ("sourceActivityEventId") REFERENCES "UserActivityEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
