CREATE TABLE "MerchantAiEmployeeInstallation" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'active',
    "grantedPermissions" TEXT NOT NULL DEFAULT '[]',
    "installedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantAiEmployeeInstallation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MerchantAiEmployeeInstallation_status_check"
        CHECK ("status" IN ('active', 'paused'))
);

CREATE UNIQUE INDEX "MerchantAiEmployeeInstallation_merchantId_definitionId_key"
ON "MerchantAiEmployeeInstallation"("merchantId", "definitionId");

CREATE INDEX "MerchantAiEmployeeInstallation_merchantId_status_createdAt_idx"
ON "MerchantAiEmployeeInstallation"("merchantId", "status", "createdAt");

CREATE INDEX "MerchantAiEmployeeInstallation_definitionId_status_idx"
ON "MerchantAiEmployeeInstallation"("definitionId", "status");

ALTER TABLE "MerchantAiEmployeeInstallation"
ADD CONSTRAINT "MerchantAiEmployeeInstallation_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantAiEmployeeInstallation"
ADD CONSTRAINT "MerchantAiEmployeeInstallation_definitionId_fkey"
FOREIGN KEY ("definitionId") REFERENCES "AiEmployeeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
