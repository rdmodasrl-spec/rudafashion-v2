-- 七种行业后台：门店、门店库存、调拨与 POS 销售记录（纯新增，可回滚为删表）
ALTER TABLE "Product" ADD COLUMN "industryAttributes" TEXT;

CREATE TABLE "MerchantStore" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "address" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "country" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "status" VARCHAR(24) NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantStore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantStoreStock" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "styleNo" VARCHAR(100) NOT NULL DEFAULT '',
  "productName" VARCHAR(200) NOT NULL DEFAULT '',
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantStoreStock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantStoreTransfer" (
  "id" TEXT NOT NULL,
  "transferNo" VARCHAR(48) NOT NULL,
  "merchantId" TEXT NOT NULL,
  "fromStoreId" TEXT NOT NULL,
  "toStoreId" TEXT NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'requested',
  "note" TEXT,
  "idempotencyKey" VARCHAR(160),
  "createdBy" VARCHAR(160),
  "dispatchedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantStoreTransfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantStoreTransferItem" (
  "id" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "styleNo" VARCHAR(100) NOT NULL DEFAULT '',
  "productName" VARCHAR(200) NOT NULL DEFAULT '',
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "MerchantStoreTransferItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantPosSale" (
  "id" TEXT NOT NULL,
  "saleNo" VARCHAR(48) NOT NULL,
  "merchantId" TEXT NOT NULL,
  "storeId" TEXT,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'EUR',
  "paymentMethod" VARCHAR(24) NOT NULL,
  "idempotencyKey" VARCHAR(160),
  "createdBy" VARCHAR(160),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantPosSale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantPosSaleItem" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "styleNo" VARCHAR(100) NOT NULL DEFAULT '',
  "productName" VARCHAR(200) NOT NULL DEFAULT '',
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,4) NOT NULL,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "MerchantPosSaleItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantStore_merchantId_code_key" ON "MerchantStore"("merchantId", "code");
CREATE INDEX "MerchantStore_merchantId_status_idx" ON "MerchantStore"("merchantId", "status");
CREATE UNIQUE INDEX "MerchantStoreStock_storeId_productId_sku_key" ON "MerchantStoreStock"("storeId", "productId", "sku");
CREATE INDEX "MerchantStoreStock_merchantId_sku_idx" ON "MerchantStoreStock"("merchantId", "sku");
CREATE INDEX "MerchantStoreStock_productId_idx" ON "MerchantStoreStock"("productId");
CREATE UNIQUE INDEX "MerchantStoreTransfer_transferNo_key" ON "MerchantStoreTransfer"("transferNo");
CREATE UNIQUE INDEX "MerchantStoreTransfer_idempotencyKey_key" ON "MerchantStoreTransfer"("idempotencyKey");
CREATE INDEX "MerchantStoreTransfer_merchantId_status_createdAt_idx" ON "MerchantStoreTransfer"("merchantId", "status", "createdAt");
CREATE INDEX "MerchantStoreTransfer_fromStoreId_idx" ON "MerchantStoreTransfer"("fromStoreId");
CREATE INDEX "MerchantStoreTransfer_toStoreId_idx" ON "MerchantStoreTransfer"("toStoreId");
CREATE INDEX "MerchantStoreTransferItem_transferId_idx" ON "MerchantStoreTransferItem"("transferId");
CREATE INDEX "MerchantStoreTransferItem_productId_sku_idx" ON "MerchantStoreTransferItem"("productId", "sku");
CREATE UNIQUE INDEX "MerchantPosSale_saleNo_key" ON "MerchantPosSale"("saleNo");
CREATE UNIQUE INDEX "MerchantPosSale_idempotencyKey_key" ON "MerchantPosSale"("idempotencyKey");
CREATE INDEX "MerchantPosSale_merchantId_createdAt_idx" ON "MerchantPosSale"("merchantId", "createdAt");
CREATE INDEX "MerchantPosSale_storeId_createdAt_idx" ON "MerchantPosSale"("storeId", "createdAt");
CREATE INDEX "MerchantPosSaleItem_saleId_idx" ON "MerchantPosSaleItem"("saleId");
CREATE INDEX "MerchantPosSaleItem_productId_sku_idx" ON "MerchantPosSaleItem"("productId", "sku");

ALTER TABLE "MerchantStore" ADD CONSTRAINT "MerchantStore_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantStoreStock" ADD CONSTRAINT "MerchantStoreStock_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantStoreStock" ADD CONSTRAINT "MerchantStoreStock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "MerchantStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantStoreTransfer" ADD CONSTRAINT "MerchantStoreTransfer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantStoreTransfer" ADD CONSTRAINT "MerchantStoreTransfer_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "MerchantStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantStoreTransfer" ADD CONSTRAINT "MerchantStoreTransfer_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "MerchantStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantStoreTransferItem" ADD CONSTRAINT "MerchantStoreTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "MerchantStoreTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantPosSale" ADD CONSTRAINT "MerchantPosSale_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantPosSale" ADD CONSTRAINT "MerchantPosSale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "MerchantStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantPosSaleItem" ADD CONSTRAINT "MerchantPosSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "MerchantPosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

