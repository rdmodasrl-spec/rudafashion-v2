CREATE TABLE "ProductReservationRequest" (
  "id" TEXT NOT NULL,
  "requestNo" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "totalQty" INTEGER NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "items" TEXT NOT NULL,
  "notes" TEXT,
  "decisionNote" TEXT,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductReservationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductReservationRequest_requestNo_key"
  ON "ProductReservationRequest"("requestNo");
CREATE INDEX "ProductReservationRequest_merchantId_status_createdAt_idx"
  ON "ProductReservationRequest"("merchantId", "status", "createdAt");
CREATE INDEX "ProductReservationRequest_customerId_createdAt_idx"
  ON "ProductReservationRequest"("customerId", "createdAt");
CREATE INDEX "ProductReservationRequest_productId_createdAt_idx"
  ON "ProductReservationRequest"("productId", "createdAt");

ALTER TABLE "ProductReservationRequest"
  ADD CONSTRAINT "ProductReservationRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductReservationRequest"
  ADD CONSTRAINT "ProductReservationRequest_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductReservationRequest"
  ADD CONSTRAINT "ProductReservationRequest_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
