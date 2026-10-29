CREATE TABLE "MerchantPurchaseOrder" (
  "id" TEXT NOT NULL,
  "purchaseOrderNo" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "expectedAt" TIMESTAMP(3),
  "orderedAt" TIMESTAMP(3),
  "notes" TEXT,
  "idempotencyKey" TEXT,
  "payloadHash" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantPurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantPurchaseOrderItem" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "styleNo" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "color" TEXT,
  "size" TEXT,
  "orderedQuantity" INTEGER NOT NULL,
  "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(12,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantPurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantPurchaseReceipt" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "note" TEXT,
  "receivedBy" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantPurchaseReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantPurchaseReceiptItem" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "purchaseOrderItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,4) NOT NULL,
  CONSTRAINT "MerchantPurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantPurchaseOrder_purchaseOrderNo_key" ON "MerchantPurchaseOrder"("purchaseOrderNo");
CREATE UNIQUE INDEX "MerchantPurchaseOrder_idempotencyKey_key" ON "MerchantPurchaseOrder"("idempotencyKey");
CREATE INDEX "MerchantPurchaseOrder_merchantId_status_createdAt_idx" ON "MerchantPurchaseOrder"("merchantId", "status", "createdAt");
CREATE INDEX "MerchantPurchaseOrder_supplierId_createdAt_idx" ON "MerchantPurchaseOrder"("supplierId", "createdAt");
CREATE INDEX "MerchantPurchaseOrderItem_purchaseOrderId_idx" ON "MerchantPurchaseOrderItem"("purchaseOrderId");
CREATE INDEX "MerchantPurchaseOrderItem_productId_variantId_idx" ON "MerchantPurchaseOrderItem"("productId", "variantId");
CREATE UNIQUE INDEX "MerchantPurchaseReceipt_idempotencyKey_key" ON "MerchantPurchaseReceipt"("idempotencyKey");
CREATE INDEX "MerchantPurchaseReceipt_merchantId_receivedAt_idx" ON "MerchantPurchaseReceipt"("merchantId", "receivedAt");
CREATE INDEX "MerchantPurchaseReceipt_purchaseOrderId_receivedAt_idx" ON "MerchantPurchaseReceipt"("purchaseOrderId", "receivedAt");
CREATE UNIQUE INDEX "MerchantPurchaseReceiptItem_receiptId_purchaseOrderItemId_key" ON "MerchantPurchaseReceiptItem"("receiptId", "purchaseOrderItemId");
CREATE INDEX "MerchantPurchaseReceiptItem_purchaseOrderItemId_idx" ON "MerchantPurchaseReceiptItem"("purchaseOrderItemId");

ALTER TABLE "MerchantPurchaseOrder"
  ADD CONSTRAINT "MerchantPurchaseOrder_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MerchantPurchaseOrder_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantPurchaseOrderItem"
  ADD CONSTRAINT "MerchantPurchaseOrderItem_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "MerchantPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantPurchaseReceipt"
  ADD CONSTRAINT "MerchantPurchaseReceipt_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "MerchantPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantPurchaseReceiptItem"
  ADD CONSTRAINT "MerchantPurchaseReceiptItem_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "MerchantPurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MerchantPurchaseReceiptItem_purchaseOrderItemId_fkey"
  FOREIGN KEY ("purchaseOrderItemId") REFERENCES "MerchantPurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
