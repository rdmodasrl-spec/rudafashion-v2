-- Real view/completion events for the fashion community feed.
-- Idempotent by design: the deployment database currently has migration history
-- that is ahead of this repository, so this file may be applied by `prisma migrate
-- deploy` later or by an operator with psql without risking a duplicate object.

CREATE TABLE IF NOT EXISTS "FashionCommunityView" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "bucket" INTEGER NOT NULL,
    "watchedMs" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FashionCommunityView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FashionCommunityView_postId_viewerId_bucket_key"
    ON "FashionCommunityView"("postId", "viewerId", "bucket");

CREATE INDEX IF NOT EXISTS "FashionCommunityView_postId_createdAt_idx"
    ON "FashionCommunityView"("postId", "createdAt");

CREATE INDEX IF NOT EXISTS "FashionCommunityView_viewerId_createdAt_idx"
    ON "FashionCommunityView"("viewerId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FashionCommunityView_postId_fkey'
    ) THEN
        ALTER TABLE "FashionCommunityView"
            ADD CONSTRAINT "FashionCommunityView_postId_fkey"
            FOREIGN KEY ("postId") REFERENCES "FashionCommunityPost"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
