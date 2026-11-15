-- MODAUI 广告策划器（P1）：商品简报 / 三套广告方案 / 分镜版本。
-- 纯新增三张表；不改既有列、不回填业务数据，也不存任何生成产物。
-- 回滚：DROP 三张表即可；旧代码与既有模块不读取这些结构。
CREATE TABLE IF NOT EXISTS "AiAdProject" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "productId" TEXT,
  "title" VARCHAR(160) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
  "brief" JSONB NOT NULL,
  "briefHash" VARCHAR(64) NOT NULL,
  "selectedConceptId" TEXT,
  "currentVersionNo" INTEGER NOT NULL DEFAULT 0,
  "costEstimate" JSONB,
  "createdBy" TEXT,
  "clientRequestId" VARCHAR(128),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAdProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiAdProject_merchantId_clientRequestId_key"
ON "AiAdProject"("merchantId", "clientRequestId");

CREATE INDEX IF NOT EXISTS "AiAdProject_merchantId_updatedAt_idx"
ON "AiAdProject"("merchantId", "updatedAt");

CREATE INDEX IF NOT EXISTS "AiAdProject_merchantId_productId_idx"
ON "AiAdProject"("merchantId", "productId");

CREATE TABLE IF NOT EXISTS "AiAdConcept" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "conceptKey" VARCHAR(32) NOT NULL,
  "route" VARCHAR(24) NOT NULL,
  "goal" VARCHAR(32) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "audience" VARCHAR(400) NOT NULL,
  "hook" VARCHAR(400) NOT NULL,
  "cta" VARCHAR(200) NOT NULL,
  "language" VARCHAR(16) NOT NULL,
  "aspectRatio" VARCHAR(12) NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "hashtags" JSONB NOT NULL,
  "script" JSONB NOT NULL,
  "storyboard" JSONB NOT NULL,
  "providerStatus" JSONB NOT NULL,
  "costEstimate" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAdConcept_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiAdConcept_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AiAdProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiAdConcept_projectId_conceptKey_key"
ON "AiAdConcept"("projectId", "conceptKey");

CREATE INDEX IF NOT EXISTS "AiAdConcept_projectId_idx"
ON "AiAdConcept"("projectId");

CREATE TABLE IF NOT EXISTS "AiAdProjectVersion" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "versionNo" INTEGER NOT NULL,
  "contentHash" VARCHAR(64) NOT NULL,
  "conceptId" TEXT NOT NULL,
  "conceptKey" VARCHAR(32) NOT NULL,
  "script" JSONB NOT NULL,
  "storyboard" JSONB NOT NULL,
  "costEstimate" JSONB NOT NULL,
  "note" VARCHAR(400),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAdProjectVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiAdProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AiAdProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiAdProjectVersion_projectId_versionNo_key"
ON "AiAdProjectVersion"("projectId", "versionNo");

CREATE UNIQUE INDEX IF NOT EXISTS "AiAdProjectVersion_projectId_contentHash_key"
ON "AiAdProjectVersion"("projectId", "contentHash");

CREATE INDEX IF NOT EXISTS "AiAdProjectVersion_projectId_createdAt_idx"
ON "AiAdProjectVersion"("projectId", "createdAt");
