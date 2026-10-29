-- Fashion community completeness (stage 3): notifications, blocks, drafts,
-- hidden posts. Idempotent because production history was reconciled by hand.
CREATE TABLE IF NOT EXISTS "FashionCommunityNotification" (
    "id" TEXT NOT NULL,
    "recipientAccountId" TEXT NOT NULL,
    "actorAccountId" TEXT,
    "actorName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "postId" TEXT,
    "postImage" TEXT,
    "commentId" TEXT,
    "preview" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FashionCommunityNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FashionCommunityNotification_recipientAccountId_createdAt_idx"
    ON "FashionCommunityNotification"("recipientAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "FashionCommunityNotification_recipientAccountId_readAt_idx"
    ON "FashionCommunityNotification"("recipientAccountId", "readAt");

CREATE TABLE IF NOT EXISTS "FashionCommunityBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FashionCommunityBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FashionCommunityBlock_blockerId_blockedId_key"
    ON "FashionCommunityBlock"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "FashionCommunityBlock_blockerId_createdAt_idx"
    ON "FashionCommunityBlock"("blockerId", "createdAt");

CREATE TABLE IF NOT EXISTS "FashionCommunityDraft" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "city" TEXT,
    "mediaItems" JSONB,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FashionCommunityDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FashionCommunityDraft_accountId_updatedAt_idx"
    ON "FashionCommunityDraft"("accountId", "updatedAt");

CREATE TABLE IF NOT EXISTS "FashionCommunityHiddenPost" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FashionCommunityHiddenPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FashionCommunityHiddenPost_accountId_postId_key"
    ON "FashionCommunityHiddenPost"("accountId", "postId");
CREATE INDEX IF NOT EXISTS "FashionCommunityHiddenPost_accountId_createdAt_idx"
    ON "FashionCommunityHiddenPost"("accountId", "createdAt");
