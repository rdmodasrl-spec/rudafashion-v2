ALTER TABLE "Merchant"
ADD COLUMN "industry" VARCHAR(32) NOT NULL DEFAULT 'OTHER';

UPDATE "Merchant"
SET "industry" = CASE LOWER("businessType")
  WHEN 'apparel' THEN 'FASHION_COMPANY'
  WHEN 'leather' THEN 'FASHION_COMPANY'
  WHEN 'tailor' THEN 'FASHION_COMPANY'
  WHEN 'atelier' THEN 'FASHION_COMPANY'
  WHEN 'brand_supplier' THEN 'FASHION_COMPANY'
  WHEN 'manufacturer' THEN 'FASHION_COMPANY'
  WHEN 'fashion_wholesale' THEN 'FASHION_WHOLESALE'
  WHEN 'department' THEN 'DEPARTMENT_STORE'
  WHEN 'department_store' THEN 'DEPARTMENT_STORE'
  WHEN 'retail' THEN 'RETAIL_STORE'
  WHEN 'retailer' THEN 'RETAIL_STORE'
  WHEN 'boutique' THEN 'RETAIL_STORE'
  WHEN 'trading' THEN 'TRADING_COMPANY'
  WHEN 'trader' THEN 'TRADING_COMPANY'
  WHEN 'import_export' THEN 'TRADING_COMPANY'
  WHEN 'wholesale' THEN 'WHOLESALE_COMPANY'
  WHEN 'wholesaler' THEN 'WHOLESALE_COMPANY'
  WHEN 'distributor' THEN 'WHOLESALE_COMPANY'
  WHEN 'restaurant' THEN 'RESTAURANT'
  WHEN 'food_service' THEN 'RESTAURANT'
  ELSE 'OTHER'
END;

CREATE TABLE "MerchantAiTeamAssignment" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "agentId" VARCHAR(48) NOT NULL,
  "industry" VARCHAR(32) NOT NULL,
  "displayName" VARCHAR(120) NOT NULL,
  "configuration" TEXT NOT NULL,
  "packVersion" VARCHAR(32) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'configured',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantAiTeamAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantAiTeamAssignment_merchantId_agentId_key"
ON "MerchantAiTeamAssignment"("merchantId", "agentId");
CREATE INDEX "MerchantAiTeamAssignment_merchantId_industry_status_idx"
ON "MerchantAiTeamAssignment"("merchantId", "industry", "status");
ALTER TABLE "MerchantAiTeamAssignment"
ADD CONSTRAINT "MerchantAiTeamAssignment_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MerchantAiTeamProvisionRun" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "industry" VARCHAR(32) NOT NULL,
  "configHash" VARCHAR(64) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'started',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantAiTeamProvisionRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantAiTeamProvisionRun_merchantId_idempotencyKey_key"
ON "MerchantAiTeamProvisionRun"("merchantId", "idempotencyKey");
CREATE INDEX "MerchantAiTeamProvisionRun_merchantId_status_createdAt_idx"
ON "MerchantAiTeamProvisionRun"("merchantId", "status", "createdAt");
ALTER TABLE "MerchantAiTeamProvisionRun"
ADD CONSTRAINT "MerchantAiTeamProvisionRun_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
