CREATE TABLE "MerchantPayoutAllocation" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "refundAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantPayoutAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantPayoutAllocation_orderId_key" ON "MerchantPayoutAllocation"("orderId");
CREATE INDEX "MerchantPayoutAllocation_payoutId_idx" ON "MerchantPayoutAllocation"("payoutId");

ALTER TABLE "MerchantPayoutAllocation" ADD CONSTRAINT "MerchantPayoutAllocation_payoutId_fkey"
  FOREIGN KEY ("payoutId") REFERENCES "MerchantPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantPayoutAllocation" ADD CONSTRAINT "MerchantPayoutAllocation_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MerchantPayout" ADD COLUMN "merchantAcknowledgedAt" TEXT;

CREATE TABLE "MerchantBankAccount" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "ibanEncrypted" TEXT NOT NULL,
    "ibanLast4" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantBankAccount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MerchantBankAccount_merchantId_status_idx" ON "MerchantBankAccount"("merchantId", "status");
CREATE INDEX "MerchantBankAccount_status_createdAt_idx" ON "MerchantBankAccount"("status", "createdAt");
ALTER TABLE "MerchantBankAccount" ADD CONSTRAINT "MerchantBankAccount_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
