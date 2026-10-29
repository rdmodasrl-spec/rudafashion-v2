ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "refundStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Order" ADD COLUMN "refundReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "refundAmount" DECIMAL(14,2);
ALTER TABLE "Order" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "MerchantPayout" ADD COLUMN "orderIds" TEXT;

CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "merchantId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "approvedQty" INTEGER,
    "refundAmount" DECIMAL(14,2),
    "items" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");
CREATE INDEX "ReturnRequest_customerId_idx" ON "ReturnRequest"("customerId");
CREATE INDEX "ReturnRequest_merchantId_idx" ON "ReturnRequest"("merchantId");
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");

ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
