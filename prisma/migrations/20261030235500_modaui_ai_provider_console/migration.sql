-- MODAUI AI 服务商控制台：调用记录表（平台级）。
-- 纯新增一张表；不改既有列、不回填业务数据，也不存任何密钥或 Authorization。
-- 回滚：DROP TABLE "AiProviderCall" 即可；旧代码不读取该结构，控制台在表缺失时返回 migrationPending。
CREATE TABLE IF NOT EXISTS "AiProviderCall" (
  "id" TEXT NOT NULL,
  "providerId" VARCHAR(32) NOT NULL,
  "modelId" VARCHAR(64) NOT NULL,
  "taskType" VARCHAR(24) NOT NULL,
  "jobId" VARCHAR(128),
  "merchantId" TEXT,
  "appId" VARCHAR(64),
  "status" VARCHAR(16) NOT NULL,
  "costCents" INTEGER,
  "costSource" VARCHAR(16),
  "estimatedCents" INTEGER,
  "pricingVersion" VARCHAR(32),
  "assetId" VARCHAR(128),
  "assetUrl" VARCHAR(1024),
  "errorCode" VARCHAR(48),
  "failureReason" VARCHAR(400),
  "durationMs" INTEGER,
  "createdBy" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AiProviderCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiProviderCall_providerId_createdAt_idx"
ON "AiProviderCall"("providerId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiProviderCall_merchantId_createdAt_idx"
ON "AiProviderCall"("merchantId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiProviderCall_status_createdAt_idx"
ON "AiProviderCall"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "AiProviderCall_jobId_idx"
ON "AiProviderCall"("jobId");
