CREATE TABLE "MerchantPayPalConfig" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "clientIdEncrypted" TEXT NOT NULL,
    "clientSecretEncrypted" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantPayPalConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantPayPalConfig_merchantId_key" ON "MerchantPayPalConfig"("merchantId");
CREATE INDEX "MerchantPayPalConfig_enabled_environment_idx" ON "MerchantPayPalConfig"("enabled", "environment");

ALTER TABLE "MerchantPayPalConfig"
ADD CONSTRAINT "MerchantPayPalConfig_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
