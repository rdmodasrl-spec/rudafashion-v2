-- 买家询价（RFQ）：补齐前端 /api/buyer/rfq 依赖的数据表。
CREATE TABLE "RfqRequest" (
    "id" TEXT NOT NULL,
    "rfqNo" TEXT NOT NULL,
    "buyerCustomerId" TEXT NOT NULL,
    "buyerCompanyName" TEXT NOT NULL DEFAULT '',
    "buyerContactPerson" TEXT NOT NULL DEFAULT '',
    "buyerPhone" TEXT NOT NULL DEFAULT '',
    "buyerEmail" TEXT,
    "merchantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "targetQuantity" INTEGER NOT NULL DEFAULT 0,
    "targetPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "targetCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "deadlineAt" TIMESTAMP(3),
    "preferredCountries" TEXT[],
    "productIds" TEXT[],
    "items" JSONB,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "remarks" TEXT,
    "quoteCount" INTEGER NOT NULL DEFAULT 0,
    "convertedOrderNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RfqRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RfqRequest_rfqNo_key" ON "RfqRequest"("rfqNo");
CREATE INDEX "RfqRequest_buyerCustomerId_createdAt_idx" ON "RfqRequest"("buyerCustomerId", "createdAt");
CREATE INDEX "RfqRequest_merchantId_status_idx" ON "RfqRequest"("merchantId", "status");
CREATE INDEX "RfqRequest_status_createdAt_idx" ON "RfqRequest"("status", "createdAt");
