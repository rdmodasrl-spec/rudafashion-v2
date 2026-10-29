-- Fashion community stage 2: comment replies, product links, reports, appeals,
-- product clicks. Written as an idempotent migration because production was
-- originally created from a divergent migration history.
ALTER TABLE "FashionCommunityComment" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "FashionCommunityComment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'visible';
CREATE INDEX IF NOT EXISTS "FashionCommunityComment_parentId_idx" ON "FashionCommunityComment"("parentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FashionCommunityComment_parentId_fkey') THEN
    ALTER TABLE "FashionCommunityComment"
      ADD CONSTRAINT "FashionCommunityComment_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "FashionCommunityComment"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "FashionCommunityPostProduct" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FashionCommunityPostProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FashionCommunityPostProduct_postId_productId_key" ON "FashionCommunityPostProduct"("postId", "productId");
CREATE INDEX IF NOT EXISTS "FashionCommunityPostProduct_postId_sortOrder_idx" ON "FashionCommunityPostProduct"("postId", "sortOrder");
CREATE INDEX IF NOT EXISTS "FashionCommunityPostProduct_productId_idx" ON "FashionCommunityPostProduct"("productId");
CREATE INDEX IF NOT EXISTS "FashionCommunityPostProduct_merchantId_idx" ON "FashionCommunityPostProduct"("merchantId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FashionCommunityPostProduct_postId_fkey') THEN
    ALTER TABLE "FashionCommunityPostProduct"
      ADD CONSTRAINT "FashionCommunityPostProduct_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "FashionCommunityPost"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FashionCommunityPostProduct_productId_fkey') THEN
    ALTER TABLE "FashionCommunityPostProduct"
      ADD CONSTRAINT "FashionCommunityPostProduct_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "FashionCommunityReport" (
  "id" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "postId" TEXT,
  "commentId" TEXT,
  "reporterAccountId" TEXT,
  "reporterViewerId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "detail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "action" TEXT,
  "resolution" TEXT,
  "handledBy" TEXT,
  "handledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FashionCommunityReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FashionCommunityReport_targetType_targetId_reporterViewerId_key" ON "FashionCommunityReport"("targetType", "targetId", "reporterViewerId");
CREATE INDEX IF NOT EXISTS "FashionCommunityReport_status_createdAt_idx" ON "FashionCommunityReport"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "FashionCommunityReport_targetType_targetId_idx" ON "FashionCommunityReport"("targetType", "targetId");

CREATE TABLE IF NOT EXISTS "FashionCommunityAppeal" (
  "id" TEXT NOT NULL,
  "reportId" TEXT,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "resolution" TEXT,
  "handledBy" TEXT,
  "handledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FashionCommunityAppeal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FashionCommunityAppeal_status_createdAt_idx" ON "FashionCommunityAppeal"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "FashionCommunityAppeal_accountId_idx" ON "FashionCommunityAppeal"("accountId");
CREATE INDEX IF NOT EXISTS "FashionCommunityAppeal_targetType_targetId_idx" ON "FashionCommunityAppeal"("targetType", "targetId");

CREATE TABLE IF NOT EXISTS "FashionCommunityProductClick" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "viewerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FashionCommunityProductClick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FashionCommunityProductClick_postId_createdAt_idx" ON "FashionCommunityProductClick"("postId", "createdAt");
CREATE INDEX IF NOT EXISTS "FashionCommunityProductClick_productId_createdAt_idx" ON "FashionCommunityProductClick"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "FashionCommunityProductClick_viewerId_createdAt_idx" ON "FashionCommunityProductClick"("viewerId", "createdAt");
