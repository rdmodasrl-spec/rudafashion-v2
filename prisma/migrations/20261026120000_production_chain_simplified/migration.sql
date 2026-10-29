-- RUDA 智能生产链 v2：简化为「加工单 → 取货 → 送货验收 → 月度结算 → 付款 + 单据留言」
-- 背景：v1（20261025190000_production_chain_app）尚未发布上线，BOM/发料/工序进度/按单对账超出真实业务模型。
-- 处理：删除从未写入生产数据的 v1 扩展表；保留加工单、工厂、送货验收与付款主体并做兼容改造。
-- 可重复执行；执行前必须备份数据库。删除表的恢复只能依赖备份。

-- 1) 解除对旧对账表的依赖并删除 v1 扩展表
ALTER TABLE "ProductionPayment" DROP CONSTRAINT IF EXISTS "ProductionPayment_reconciliationId_fkey";
DROP TABLE IF EXISTS "ProductionReconciliationLine";
DROP TABLE IF EXISTS "ProductionReconciliation";
DROP TABLE IF EXISTS "ProductionBomSnapshot";
DROP TABLE IF EXISTS "ProductionMaterialMovement";
DROP TABLE IF EXISTS "ProductionProgressReport";

-- 2) 加工厂：移除 v1 能力标签
ALTER TABLE "ProductionFactory" DROP COLUMN IF EXISTS "capabilities";
ALTER TABLE "ProductionFactoryMember" ALTER COLUMN "role" SET DEFAULT 'owner';

-- 3) 加工单：以取货日期替代 v1 内部生产字段
ALTER TABLE "ProductionOrder" DROP COLUMN IF EXISTS "productionMethod";
ALTER TABLE "ProductionOrder" DROP COLUMN IF EXISTS "startDate";
ALTER TABLE "ProductionOrder" DROP COLUMN IF EXISTS "priority";
ALTER TABLE "ProductionOrder" DROP COLUMN IF EXISTS "deliveryAddress";
ALTER TABLE "ProductionOrder" DROP COLUMN IF EXISTS "processNotes";
ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "pickupDate" TIMESTAMP(3);
ALTER TABLE "ProductionOrderItem" ADD COLUMN IF NOT EXISTS "shortageQuantity" INTEGER NOT NULL DEFAULT 0;

-- 4) 送货：只保留工厂登记 + 商家验收字段
ALTER TABLE "ProductionDelivery" DROP COLUMN IF EXISTS "carrier";
ALTER TABLE "ProductionDelivery" DROP COLUMN IF EXISTS "trackingNo";
ALTER TABLE "ProductionDelivery" DROP COLUMN IF EXISTS "shippingNote";
ALTER TABLE "ProductionDelivery" DROP COLUMN IF EXISTS "submittedBy";
ALTER TABLE "ProductionDelivery" DROP COLUMN IF EXISTS "receivedAt";
ALTER TABLE "ProductionDelivery" DROP COLUMN IF EXISTS "idempotencyKey";
ALTER TABLE "ProductionDelivery" DROP COLUMN IF EXISTS "notes";
ALTER TABLE "ProductionDelivery" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "ProductionDelivery" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductionDelivery" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductionDelivery" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ProductionDeliveryItem" DROP COLUMN IF EXISTS "sku";
ALTER TABLE "ProductionDeliveryItem" ADD COLUMN IF NOT EXISTS "statementId" TEXT;
CREATE INDEX IF NOT EXISTS "ProductionDeliveryItem_statementId_idx" ON "ProductionDeliveryItem"("statementId");
ALTER TABLE "ProductionOrderEvent" ALTER COLUMN "actorType" DROP DEFAULT;

-- 5) 付款：从「按单对账」改为「按工厂 + 月度结算」，允许未分配付款
ALTER TABLE "ProductionPayment" DROP COLUMN IF EXISTS "reconciliationId";
ALTER TABLE "ProductionPayment" ADD COLUMN IF NOT EXISTS "factoryId" TEXT;
ALTER TABLE "ProductionPayment" ADD COLUMN IF NOT EXISTS "statementId" TEXT;
ALTER TABLE "ProductionPayment" ADD COLUMN IF NOT EXISTS "note" TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProductionPayment" WHERE "factoryId" IS NULL) THEN
    RAISE EXCEPTION 'ProductionPayment rows without factoryId require manual backfill before applying 20261026120000_production_chain_simplified';
  END IF;
END $$;
ALTER TABLE "ProductionPayment" ALTER COLUMN "factoryId" SET NOT NULL;

DROP INDEX IF EXISTS "ProductionPayment_reconciliationId_idx";
CREATE INDEX IF NOT EXISTS "ProductionPayment_factoryId_paidAt_idx" ON "ProductionPayment"("factoryId", "paidAt");
CREATE INDEX IF NOT EXISTS "ProductionPayment_statementId_idx" ON "ProductionPayment"("statementId");

-- 6) 取货交接
CREATE TABLE IF NOT EXISTS "ProductionPickup" (
  "id" TEXT NOT NULL,
  "pickupNo" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "pickupDate" TIMESTAMP(3) NOT NULL,
  "pieces" INTEGER NOT NULL,
  "packages" INTEGER NOT NULL DEFAULT 0,
  "receivedPieces" INTEGER,
  "difference" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "merchantConfirmedAt" TIMESTAMP(3),
  "factoryConfirmedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionPickup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionPickup_pickupNo_key" ON "ProductionPickup"("pickupNo");
CREATE INDEX IF NOT EXISTS "ProductionPickup_orderId_pickupDate_idx" ON "ProductionPickup"("orderId", "pickupDate");
CREATE INDEX IF NOT EXISTS "ProductionPickup_factoryId_status_idx" ON "ProductionPickup"("factoryId", "status");

-- 7) 月度结算
CREATE TABLE IF NOT EXISTS "ProductionStatement" (
  "id" TEXT NOT NULL,
  "statementNo" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "periodMonth" VARCHAR(7) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "laborAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "adjustmentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "closingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "disputeReason" TEXT,
  "merchantConfirmedAt" TIMESTAMP(3),
  "factoryConfirmedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionStatement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionStatement_statementNo_key" ON "ProductionStatement"("statementNo");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionStatement_factoryId_periodMonth_version_key" ON "ProductionStatement"("factoryId", "periodMonth", "version");
CREATE INDEX IF NOT EXISTS "ProductionStatement_merchantId_status_idx" ON "ProductionStatement"("merchantId", "status");
CREATE INDEX IF NOT EXISTS "ProductionStatement_factoryId_periodMonth_idx" ON "ProductionStatement"("factoryId", "periodMonth");

CREATE TABLE IF NOT EXISTS "ProductionStatementLine" (
  "id" TEXT NOT NULL,
  "statementId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderNo" TEXT NOT NULL,
  "styleNo" TEXT,
  "productName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "breakdown" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductionStatementLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProductionStatementLine_statementId_sortOrder_idx" ON "ProductionStatementLine"("statementId", "sortOrder");

CREATE TABLE IF NOT EXISTS "ProductionStatementAdjustment" (
  "id" TEXT NOT NULL,
  "statementId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdBySide" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionStatementAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProductionStatementAdjustment_statementId_idx" ON "ProductionStatementAdjustment"("statementId");


-- 8) 单据留言（订单/结算单范围，双方可见）
CREATE TABLE IF NOT EXISTS "ProductionMessage" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "authorSide" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readByMerchantAt" TIMESTAMP(3),
  "readByFactoryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProductionMessage_scopeType_scopeId_createdAt_idx" ON "ProductionMessage"("scopeType", "scopeId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductionMessage_factoryId_scopeId_idx" ON "ProductionMessage"("factoryId", "scopeId");
CREATE INDEX IF NOT EXISTS "ProductionMessage_merchantId_createdAt_idx" ON "ProductionMessage"("merchantId", "createdAt");

-- 9) 索引校正
DROP INDEX IF EXISTS "ProductionDelivery_orderId_status_idx";
CREATE INDEX IF NOT EXISTS "ProductionDelivery_orderId_submittedAt_idx" ON "ProductionDelivery"("orderId", "submittedAt");
CREATE INDEX IF NOT EXISTS "ProductionDelivery_factoryId_status_idx" ON "ProductionDelivery"("factoryId", "status");
CREATE INDEX IF NOT EXISTS "ProductionDelivery_merchantId_status_idx" ON "ProductionDelivery"("merchantId", "status");
DROP INDEX IF EXISTS "ProductionDelivery_merchantId_submittedAt_idx";

-- 10) 外键（可重复执行）
ALTER TABLE "ProductionPickup" DROP CONSTRAINT IF EXISTS "ProductionPickup_orderId_fkey";
ALTER TABLE "ProductionPickup" ADD CONSTRAINT "ProductionPickup_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionPickup" DROP CONSTRAINT IF EXISTS "ProductionPickup_factoryId_fkey";
ALTER TABLE "ProductionPickup" ADD CONSTRAINT "ProductionPickup_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "ProductionFactory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionStatement" DROP CONSTRAINT IF EXISTS "ProductionStatement_merchantId_fkey";
ALTER TABLE "ProductionStatement" ADD CONSTRAINT "ProductionStatement_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionStatement" DROP CONSTRAINT IF EXISTS "ProductionStatement_factoryId_fkey";
ALTER TABLE "ProductionStatement" ADD CONSTRAINT "ProductionStatement_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "ProductionFactory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionStatementLine" DROP CONSTRAINT IF EXISTS "ProductionStatementLine_statementId_fkey";
ALTER TABLE "ProductionStatementLine" ADD CONSTRAINT "ProductionStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "ProductionStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionStatementLine" DROP CONSTRAINT IF EXISTS "ProductionStatementLine_orderId_fkey";
ALTER TABLE "ProductionStatementLine" ADD CONSTRAINT "ProductionStatementLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionStatementAdjustment" DROP CONSTRAINT IF EXISTS "ProductionStatementAdjustment_statementId_fkey";
ALTER TABLE "ProductionStatementAdjustment" ADD CONSTRAINT "ProductionStatementAdjustment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "ProductionStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionDeliveryItem" DROP CONSTRAINT IF EXISTS "ProductionDeliveryItem_statementId_fkey";
ALTER TABLE "ProductionDeliveryItem" ADD CONSTRAINT "ProductionDeliveryItem_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "ProductionStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionDelivery" DROP CONSTRAINT IF EXISTS "ProductionDelivery_factoryId_fkey";
ALTER TABLE "ProductionDelivery" ADD CONSTRAINT "ProductionDelivery_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "ProductionFactory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionPayment" DROP CONSTRAINT IF EXISTS "ProductionPayment_factoryId_fkey";
ALTER TABLE "ProductionPayment" ADD CONSTRAINT "ProductionPayment_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "ProductionFactory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionPayment" DROP CONSTRAINT IF EXISTS "ProductionPayment_statementId_fkey";
ALTER TABLE "ProductionPayment" ADD CONSTRAINT "ProductionPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "ProductionStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionMessage" DROP CONSTRAINT IF EXISTS "ProductionMessage_merchantId_fkey";
ALTER TABLE "ProductionMessage" ADD CONSTRAINT "ProductionMessage_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionMessage" DROP CONSTRAINT IF EXISTS "ProductionMessage_factoryId_fkey";
ALTER TABLE "ProductionMessage" ADD CONSTRAINT "ProductionMessage_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "ProductionFactory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

