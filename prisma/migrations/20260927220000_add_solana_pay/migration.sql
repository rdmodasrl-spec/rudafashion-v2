CREATE TABLE "MerchantSolanaConfig" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "walletAddress" VARCHAR(64) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.02,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantSolanaConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantSolanaConfig_merchantId_key" ON "MerchantSolanaConfig"("merchantId");
CREATE INDEX "MerchantSolanaConfig_enabled_idx" ON "MerchantSolanaConfig"("enabled");

ALTER TABLE "MerchantSolanaConfig"
ADD CONSTRAINT "MerchantSolanaConfig_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SolanaPaymentIntent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "requestTokenHash" VARCHAR(64) NOT NULL,
    "requestTokenEncrypted" TEXT NOT NULL,
    "recipient" VARCHAR(64) NOT NULL,
    "platformWallet" VARCHAR(64) NOT NULL,
    "mint" VARCHAR(64) NOT NULL,
    "tokenSymbol" VARCHAR(8) NOT NULL,
    "eurAmount" DECIMAL(14,2) NOT NULL,
    "exchangeRate" DECIMAL(20,10) NOT NULL,
    "exchangeRateSource" VARCHAR(64) NOT NULL,
    "exchangeRateUpdatedAt" TIMESTAMP(3) NOT NULL,
    "tokenAmount" DECIMAL(20,6) NOT NULL,
    "amountAtomic" VARCHAR(24) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "merchantAmount" DECIMAL(20,6) NOT NULL,
    "merchantAmountAtomic" VARCHAR(24) NOT NULL,
    "commissionAmount" DECIMAL(20,6) NOT NULL,
    "commissionAmountAtomic" VARCHAR(24) NOT NULL,
    "quotedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "signature" VARCHAR(128),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolanaPaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SolanaPaymentIntent_orderId_key" ON "SolanaPaymentIntent"("orderId");
CREATE UNIQUE INDEX "SolanaPaymentIntent_reference_key" ON "SolanaPaymentIntent"("reference");
CREATE UNIQUE INDEX "SolanaPaymentIntent_requestTokenHash_key" ON "SolanaPaymentIntent"("requestTokenHash");
CREATE UNIQUE INDEX "SolanaPaymentIntent_signature_key" ON "SolanaPaymentIntent"("signature");
CREATE INDEX "SolanaPaymentIntent_merchantId_status_expiresAt_idx" ON "SolanaPaymentIntent"("merchantId", "status", "expiresAt");
CREATE INDEX "SolanaPaymentIntent_status_expiresAt_idx" ON "SolanaPaymentIntent"("status", "expiresAt");

ALTER TABLE "SolanaPaymentIntent"
ADD CONSTRAINT "SolanaPaymentIntent_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SolanaPaymentIntent"
ADD CONSTRAINT "SolanaPaymentIntent_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
