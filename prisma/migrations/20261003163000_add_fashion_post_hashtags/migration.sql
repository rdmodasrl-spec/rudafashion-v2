ALTER TABLE "FashionCommunityPost"
ADD COLUMN "hashtags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
