CREATE TABLE "ProductionWorkOrder" (
    "id" TEXT NOT NULL,
    "workOrderNo" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "outputLocationId" TEXT NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionWorkOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductionWorkOrder_workOrderNo_key" ON "ProductionWorkOrder"("workOrderNo");
CREATE INDEX "ProductionWorkOrder_merchantId_status_dueDate_idx" ON "ProductionWorkOrder"("merchantId", "status", "dueDate");
CREATE INDEX "ProductionWorkOrder_variantId_idx" ON "ProductionWorkOrder"("variantId");
CREATE INDEX "ProductionWorkOrder_outputLocationId_idx" ON "ProductionWorkOrder"("outputLocationId");
ALTER TABLE "ProductionWorkOrder" ADD CONSTRAINT "ProductionWorkOrder_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionWorkOrder" ADD CONSTRAINT "ProductionWorkOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionWorkOrder" ADD CONSTRAINT "ProductionWorkOrder_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionWorkOrder" ADD CONSTRAINT "ProductionWorkOrder_outputLocationId_fkey" FOREIGN KEY ("outputLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductionReport" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "goodQuantity" INTEGER NOT NULL,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "reportedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductionReport_idempotencyKey_key" ON "ProductionReport"("idempotencyKey");
CREATE INDEX "ProductionReport_workOrderId_createdAt_idx" ON "ProductionReport"("workOrderId", "createdAt");
ALTER TABLE "ProductionReport" ADD CONSTRAINT "ProductionReport_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "ProductionWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
