ALTER TABLE "FashionCommunityPost"
ADD COLUMN "city" TEXT;

CREATE INDEX "FashionCommunityPost_city_category_publicationStatus_idx"
ON "FashionCommunityPost"("city", "category", "publicationStatus");
