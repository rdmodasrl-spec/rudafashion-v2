CREATE TABLE "OrderDocument" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderDocument_orderId_documentType_idx" ON "OrderDocument"("orderId", "documentType");
CREATE INDEX "OrderDocument_merchantId_createdAt_idx" ON "OrderDocument"("merchantId", "createdAt");
ALTER TABLE "OrderDocument" ADD CONSTRAINT "OrderDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDocument" ADD CONSTRAINT "OrderDocument_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
