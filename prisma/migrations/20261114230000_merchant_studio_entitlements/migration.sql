CREATE TABLE "MerchantStudioEntitlement" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "industryCode" VARCHAR(48) NOT NULL,
  "industryTemplate" VARCHAR(48) NOT NULL,
  "studioCode" VARCHAR(32) NOT NULL,
  "mode" VARCHAR(16) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "capabilities" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "grantedBy" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "source" VARCHAR(32) NOT NULL,
  CONSTRAINT "MerchantStudioEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantStudioEntitlement_merchant_industry_studio_mode_key"
  ON "MerchantStudioEntitlement"("merchantId", "industryCode", "studioCode", "mode");
CREATE INDEX "MerchantStudioEntitlement_merchantId_status_idx"
  ON "MerchantStudioEntitlement"("merchantId", "status");
CREATE INDEX "MerchantStudioEntitlement_studioCode_industryCode_status_idx"
  ON "MerchantStudioEntitlement"("studioCode", "industryCode", "status");

ALTER TABLE "MerchantStudioEntitlement"
  ADD CONSTRAINT "MerchantStudioEntitlement_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
