-- Fashion season filter (stage 4). Additive and nullable so legacy posts and
-- drafts keep working without a backfill.
ALTER TABLE "FashionCommunityPost" ADD COLUMN IF NOT EXISTS "season" TEXT;
ALTER TABLE "FashionCommunityDraft" ADD COLUMN IF NOT EXISTS "season" TEXT;

CREATE INDEX IF NOT EXISTS "FashionCommunityPost_season_publicationStatus_createdAt_idx"
  ON "FashionCommunityPost"("season", "publicationStatus", "createdAt");
