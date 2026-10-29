CREATE TABLE "MerchantStripeConfig" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "secretKeyEncrypted" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantStripeConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantStripeConfig_merchantId_key" ON "MerchantStripeConfig"("merchantId");
CREATE INDEX "MerchantStripeConfig_enabled_livemode_idx" ON "MerchantStripeConfig"("enabled", "livemode");

ALTER TABLE "MerchantStripeConfig"
ADD CONSTRAINT "MerchantStripeConfig_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
