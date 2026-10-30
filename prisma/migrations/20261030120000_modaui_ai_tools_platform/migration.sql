-- MODAUI AI Tools 平台：Tool Manifest v1 注册表投影、商家级工具授权、安装状态留痕。
-- 纯新增：加一列（App.manifest）与三张表，不修改既有列、不回填业务数据。
-- 回滚：删除三张表与 App.manifest 列即可；旧代码不读取这些结构，删除不影响既有应用。
ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "manifest" JSONB;

CREATE TABLE IF NOT EXISTS "AiToolRegistryEntry" (
  "toolId" VARCHAR(120) NOT NULL,
  "appId" VARCHAR(120) NOT NULL,
  "appRecordId" TEXT NOT NULL,
  "version" VARCHAR(32) NOT NULL,
  "displayName" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "status" VARCHAR(24) NOT NULL DEFAULT 'published',
  "riskLevel" VARCHAR(16) NOT NULL DEFAULT 'LOW',
  "permission" VARCHAR(80) NOT NULL,
  "cost" JSONB NOT NULL,
  "industries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "employees" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "credentials" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "fingerprint" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiToolRegistryEntry_pkey" PRIMARY KEY ("toolId")
);

CREATE INDEX IF NOT EXISTS "AiToolRegistryEntry_appId_status_idx"
ON "AiToolRegistryEntry"("appId", "status");
CREATE INDEX IF NOT EXISTS "AiToolRegistryEntry_status_enabled_idx"
ON "AiToolRegistryEntry"("status", "enabled");

CREATE TABLE IF NOT EXISTS "MerchantToolGrant" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "toolId" VARCHAR(120) NOT NULL,
  "appId" VARCHAR(120) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'active',
  "source" VARCHAR(24) NOT NULL DEFAULT 'app-install',
  "grantedBy" VARCHAR(160),
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedReason" VARCHAR(160),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantToolGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantToolGrant_merchantId_toolId_key"
ON "MerchantToolGrant"("merchantId", "toolId");
CREATE INDEX IF NOT EXISTS "MerchantToolGrant_merchantId_status_idx"
ON "MerchantToolGrant"("merchantId", "status");
CREATE INDEX IF NOT EXISTS "MerchantToolGrant_appId_status_idx"
ON "MerchantToolGrant"("appId", "status");
CREATE INDEX IF NOT EXISTS "MerchantToolGrant_merchantId_appId_idx"
ON "MerchantToolGrant"("merchantId", "appId");

CREATE TABLE IF NOT EXISTS "AppInstallationStatusEvent" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "appRecordId" TEXT NOT NULL,
  "appId" VARCHAR(120) NOT NULL,
  "fromStatus" VARCHAR(24),
  "toStatus" VARCHAR(24) NOT NULL,
  "actorId" VARCHAR(160),
  "reason" VARCHAR(160),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppInstallationStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppInstallationStatusEvent_merchantId_createdAt_idx"
ON "AppInstallationStatusEvent"("merchantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AppInstallationStatusEvent_appId_createdAt_idx"
ON "AppInstallationStatusEvent"("appId", "createdAt");
