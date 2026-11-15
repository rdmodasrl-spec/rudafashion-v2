CREATE TABLE "RestaurantPurchaseOrder" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestaurantPurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantPurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "ingredientCodeSnapshot" VARCHAR(80) NOT NULL,
    "ingredientNameSnapshot" VARCHAR(200) NOT NULL,
    "unitSnapshot" VARCHAR(16) NOT NULL,
    "orderedQuantity" DECIMAL(14,3) NOT NULL,
    "receivedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "quotedUnitCost" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestaurantPurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantPurchaseReceipt" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "receivedBy" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantPurchaseReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantPurchaseReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantPurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantPurchaseOrder_idempotencyKey_key"
    ON "RestaurantPurchaseOrder"("idempotencyKey");
CREATE INDEX "RestaurantPurchaseOrder_merchantId_status_createdAt_idx"
    ON "RestaurantPurchaseOrder"("merchantId", "status", "createdAt");
CREATE INDEX "RestaurantPurchaseOrder_supplierId_createdAt_idx"
    ON "RestaurantPurchaseOrder"("supplierId", "createdAt");

CREATE UNIQUE INDEX "RestaurantPurchaseOrderItem_purchaseOrderId_ingredientId_key"
    ON "RestaurantPurchaseOrderItem"("purchaseOrderId", "ingredientId");
CREATE INDEX "RestaurantPurchaseOrderItem_ingredientId_createdAt_idx"
    ON "RestaurantPurchaseOrderItem"("ingredientId", "createdAt");

CREATE UNIQUE INDEX "RestaurantPurchaseReceipt_idempotencyKey_key"
    ON "RestaurantPurchaseReceipt"("idempotencyKey");
CREATE INDEX "RestaurantPurchaseReceipt_merchantId_receivedAt_idx"
    ON "RestaurantPurchaseReceipt"("merchantId", "receivedAt");
CREATE INDEX "RestaurantPurchaseReceipt_purchaseOrderId_receivedAt_idx"
    ON "RestaurantPurchaseReceipt"("purchaseOrderId", "receivedAt");

CREATE UNIQUE INDEX "RestaurantPurchaseReceiptItem_receiptId_purchaseOrderItemId_key"
    ON "RestaurantPurchaseReceiptItem"("receiptId", "purchaseOrderItemId");
CREATE INDEX "RestaurantPurchaseReceiptItem_purchaseOrderItemId_createdAt_idx"
    ON "RestaurantPurchaseReceiptItem"("purchaseOrderItemId", "createdAt");

ALTER TABLE "RestaurantPurchaseOrder"
    ADD CONSTRAINT "RestaurantPurchaseOrder_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantPurchaseOrder"
    ADD CONSTRAINT "RestaurantPurchaseOrder_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RestaurantPurchaseOrderItem"
    ADD CONSTRAINT "RestaurantPurchaseOrderItem_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "RestaurantPurchaseOrder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantPurchaseOrderItem"
    ADD CONSTRAINT "RestaurantPurchaseOrderItem_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "RestaurantIngredient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RestaurantPurchaseReceipt"
    ADD CONSTRAINT "RestaurantPurchaseReceipt_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantPurchaseReceipt"
    ADD CONSTRAINT "RestaurantPurchaseReceipt_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "RestaurantPurchaseOrder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantPurchaseReceiptItem"
    ADD CONSTRAINT "RestaurantPurchaseReceiptItem_receiptId_fkey"
    FOREIGN KEY ("receiptId") REFERENCES "RestaurantPurchaseReceipt"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantPurchaseReceiptItem"
    ADD CONSTRAINT "RestaurantPurchaseReceiptItem_purchaseOrderItemId_fkey"
    FOREIGN KEY ("purchaseOrderItemId") REFERENCES "RestaurantPurchaseOrderItem"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
