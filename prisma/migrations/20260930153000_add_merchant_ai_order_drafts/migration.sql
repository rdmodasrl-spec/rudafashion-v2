ALTER TABLE "SalesQuote"
ADD COLUMN "leadTimeDays" INTEGER,
ADD COLUMN "deliveryTerms" TEXT,
ADD COLUMN "paymentTerms" TEXT;

CREATE TABLE "MerchantAiOrderDraft" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "deliveryTerms" TEXT NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "reviewNote" TEXT,
    "salesQuoteId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantAiOrderDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantAiOrderDraft_salesQuoteId_key" ON "MerchantAiOrderDraft"("salesQuoteId");
CREATE INDEX "MerchantAiOrderDraft_merchantId_status_createdAt_idx" ON "MerchantAiOrderDraft"("merchantId", "status", "createdAt");
CREATE INDEX "MerchantAiOrderDraft_customerId_createdAt_idx" ON "MerchantAiOrderDraft"("customerId", "createdAt");

ALTER TABLE "MerchantAiOrderDraft"
ADD CONSTRAINT "MerchantAiOrderDraft_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "MerchantAiOrderDraft_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "MerchantAiOrderDraft_salesQuoteId_fkey"
FOREIGN KEY ("salesQuoteId") REFERENCES "SalesQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
