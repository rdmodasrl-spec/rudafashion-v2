CREATE TABLE "PricingApprovalRequest" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "requesterEmployeeId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "baseUnitPrice" DECIMAL(10,2) NOT NULL,
  "requestedUnitPrice" DECIMAL(10,2) NOT NULL,
  "approvedUnitPrice" DECIMAL(10,2),
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "decisionNote" TEXT,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3),
  "consumedOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingApprovalRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PricingApprovalRequest_merchantId_status_createdAt_idx" ON "PricingApprovalRequest"("merchantId", "status", "createdAt");
CREATE INDEX "PricingApprovalRequest_requesterEmployeeId_createdAt_idx" ON "PricingApprovalRequest"("requesterEmployeeId", "createdAt");
CREATE INDEX "PricingApprovalRequest_customerId_productId_sku_idx" ON "PricingApprovalRequest"("customerId", "productId", "sku");
ALTER TABLE "PricingApprovalRequest" ADD CONSTRAINT "PricingApprovalRequest_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingApprovalRequest" ADD CONSTRAINT "PricingApprovalRequest_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "MerchantEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
