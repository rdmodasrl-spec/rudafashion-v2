CREATE TABLE "FashionCommunityPost" (
    "id" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "caption" TEXT,
    "category" TEXT,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "videoUrl" TEXT,
    "videoStorageKey" TEXT,
    "imageStorageKey" TEXT,
    "posterStorageKey" TEXT,
    "rightsStatus" TEXT NOT NULL DEFAULT 'authorized',
    "publicationStatus" TEXT NOT NULL DEFAULT 'pending',
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FashionCommunityPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FashionCommunityReaction" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "postId" TEXT,
    "viewerId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FashionCommunityReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FashionCommunityFollow" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FashionCommunityFollow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FashionCommunityComment" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "postId" TEXT,
    "viewerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FashionCommunityComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FashionCommunityPost_publicationStatus_createdAt_id_idx" ON "FashionCommunityPost"("publicationStatus", "createdAt", "id");
CREATE INDEX "FashionCommunityPost_publicationStatus_engagementScore_createdAt_id_idx" ON "FashionCommunityPost"("publicationStatus", "engagementScore", "createdAt", "id");
CREATE INDEX "FashionCommunityPost_merchantId_createdAt_idx" ON "FashionCommunityPost"("merchantId", "createdAt");
CREATE UNIQUE INDEX "FashionCommunityReaction_contentId_viewerId_reaction_key" ON "FashionCommunityReaction"("contentId", "viewerId", "reaction");
CREATE INDEX "FashionCommunityReaction_postId_reaction_idx" ON "FashionCommunityReaction"("postId", "reaction");
CREATE INDEX "FashionCommunityReaction_contentId_reaction_idx" ON "FashionCommunityReaction"("contentId", "reaction");
CREATE INDEX "FashionCommunityReaction_viewerId_reaction_idx" ON "FashionCommunityReaction"("viewerId", "reaction");
CREATE UNIQUE INDEX "FashionCommunityFollow_creatorId_viewerId_key" ON "FashionCommunityFollow"("creatorId", "viewerId");
CREATE INDEX "FashionCommunityFollow_creatorId_idx" ON "FashionCommunityFollow"("creatorId");
CREATE INDEX "FashionCommunityFollow_viewerId_idx" ON "FashionCommunityFollow"("viewerId");
CREATE INDEX "FashionCommunityComment_contentId_createdAt_idx" ON "FashionCommunityComment"("contentId", "createdAt");
CREATE INDEX "FashionCommunityComment_postId_idx" ON "FashionCommunityComment"("postId");

ALTER TABLE "FashionCommunityReaction" ADD CONSTRAINT "FashionCommunityReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FashionCommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FashionCommunityComment" ADD CONSTRAINT "FashionCommunityComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FashionCommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
