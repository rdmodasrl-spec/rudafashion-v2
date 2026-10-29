-- Fashion governance (stage 5): taxonomy, account restrictions, media events and
-- shared rate limit counters.
--
-- Compatibility: every statement is additive. No existing column, row, index or
-- table is dropped, so a rollback only needs the previous code build; leftover
-- tables are inert for older code.

-- 1. Taxonomy ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FashionTaxonomyTerm" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "mergedInto" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FashionTaxonomyTerm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FashionTaxonomyTerm_kind_name_key"
  ON "FashionTaxonomyTerm"("kind", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "FashionTaxonomyTerm_kind_slug_key"
  ON "FashionTaxonomyTerm"("kind", "slug");
CREATE INDEX IF NOT EXISTS "FashionTaxonomyTerm_kind_status_sortOrder_idx"
  ON "FashionTaxonomyTerm"("kind", "status", "sortOrder");

-- Seed the categories that were previously hard-coded in server.ts so admins can
-- edit, disable and merge them instead of being stuck with a static array.
INSERT INTO "FashionTaxonomyTerm" ("id", "kind", "name", "slug", "status", "sortOrder", "createdBy", "createdAt", "updatedAt")
VALUES
  ('tax-cat-womenswear', 'category', '女装趋势', 'womenswear', 'active', 10, 'migration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tax-cat-menswear',   'category', '男装趋势', 'menswear',   'active', 20, 'migration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tax-cat-shoes',      'category', '鞋履趋势', 'shoes',      'active', 30, 'migration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tax-cat-bags',       'category', '包袋配饰', 'bags',       'active', 40, 'migration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tax-cat-fabric',     'category', '面料与针织', 'fabric',   'active', 50, 'migration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tax-cat-runway',     'category', '秀场街拍', 'runway',     'active', 60, 'migration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- 2. Account restrictions ---------------------------------------------------
CREATE TABLE IF NOT EXISTS "FashionCommunityAccountRestriction" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "reportId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "scope" JSONB,
  "appliedBy" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "liftedBy" TEXT,
  "liftedAt" TIMESTAMP(3),
  "liftedReason" TEXT,
  CONSTRAINT "FashionCommunityAccountRestriction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FashionCommunityAccountRestriction_accountId_status_idx"
  ON "FashionCommunityAccountRestriction"("accountId", "status");
CREATE INDEX IF NOT EXISTS "FashionCommunityAccountRestriction_status_appliedAt_idx"
  ON "FashionCommunityAccountRestriction"("status", "appliedAt");

-- 3. Media events -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FashionMediaEvent" (
  "id" TEXT NOT NULL,
  "postId" TEXT,
  "accountId" TEXT,
  "stage" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'failed',
  "code" TEXT NOT NULL,
  "detail" TEXT,
  "mediaUrl" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "lastError" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FashionMediaEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FashionMediaEvent_status_createdAt_idx"
  ON "FashionMediaEvent"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "FashionMediaEvent_postId_idx"
  ON "FashionMediaEvent"("postId");
CREATE INDEX IF NOT EXISTS "FashionMediaEvent_stage_status_idx"
  ON "FashionMediaEvent"("stage", "status");

-- 4. Shared rate limits -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "RateLimitCounter" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "RateLimitCounter_expiresAt_idx"
  ON "RateLimitCounter"("expiresAt");
