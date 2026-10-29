-- RUDA 智能生产链：外发生产单、加工厂协作、物料保管、交货验收与对账
-- 仅新增本模块表；商品、SKU、物料、成衣库存、员工与审计沿用既有表。
-- 本迁移不修改既有列、不回填既有业务数据，可重复执行。

CREATE TABLE IF NOT EXISTS "ProductionFactory" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "capabilities" TEXT,
  "settlementTerms" TEXT,
  "status" TEXT NOT NULL DEFAULT 'invited',
  "inviteTokenHash" TEXT,
  "inviteExpiresAt" TIMESTAMP(3),
  "inviteAcceptedAt" TIMESTAMP(3),
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionFactory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionFactoryMember" (
  "id" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'follow_up',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionFactoryMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionOrder" (
  "id" TEXT NOT NULL,
  "orderNo" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "productionMethod" TEXT NOT NULL DEFAULT 'merchant_materials',
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "plannedQuantity" INTEGER NOT NULL,
  "plannedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "startDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "deliveryAddress" TEXT,
  "notes" TEXT,
  "processNotes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "color" TEXT,
  "size" TEXT,
  "plannedQuantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "deliveredQuantity" INTEGER NOT NULL DEFAULT 0,
  "acceptedQuantity" INTEGER NOT NULL DEFAULT 0,
  "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
  "reworkQuantity" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductionOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionBomSnapshot" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "quantityPerUnit" DECIMAL(14,4) NOT NULL,
  "wasteRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
  "plannedQuantity" DECIMAL(14,4) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionBomSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionOrderEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "actorType" TEXT NOT NULL DEFAULT 'merchant',
  "actorId" TEXT,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "payload" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionMaterialMovement" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "movementType" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "referenceNo" TEXT,
  "idempotencyKey" TEXT,
  "actorType" TEXT NOT NULL DEFAULT 'merchant',
  "actorId" TEXT,
  "note" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionMaterialMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionProgressReport" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "completedQuantity" INTEGER NOT NULL DEFAULT 0,
  "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
  "reworkQuantity" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "photos" TEXT,
  "reportedByType" TEXT NOT NULL DEFAULT 'factory',
  "reportedById" TEXT,
  "idempotencyKey" TEXT,
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionProgressReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionDelivery" (
  "id" TEXT NOT NULL,
  "deliveryNo" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "carrier" TEXT,
  "trackingNo" TEXT,
  "shippingNote" TEXT,
  "submittedBy" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMP(3),
  "inspectedAt" TIMESTAMP(3),
  "inspectedBy" TEXT,
  "notes" TEXT,
  "idempotencyKey" TEXT,
  CONSTRAINT "ProductionDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionDeliveryItem" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "declaredQuantity" INTEGER NOT NULL,
  "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
  "acceptedQuantity" INTEGER NOT NULL DEFAULT 0,
  "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
  "reworkQuantity" INTEGER NOT NULL DEFAULT 0,
  "shortageQuantity" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductionDeliveryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionQualityInspection" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "inspector" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionQualityInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionReconciliation" (
  "id" TEXT NOT NULL,
  "reconciliationNo" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "factoryId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "version" INTEGER NOT NULL DEFAULT 1,
  "billableQuantity" INTEGER NOT NULL DEFAULT 0,
  "laborAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "extraAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "adjustmentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "disputedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "factoryConfirmedAt" TIMESTAMP(3),
  "merchantConfirmedAt" TIMESTAMP(3),
  "confirmedVersion" INTEGER,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionReconciliationLine" (
  "id" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER,
  "unitPrice" DECIMAL(12,4),
  "amount" DECIMAL(14,2) NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductionReconciliationLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionPayment" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "method" TEXT,
  "reference" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "recordedBy" TEXT,
  "proofUrl" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionPayment_pkey" PRIMARY KEY ("id")
);



CREATE UNIQUE INDEX IF NOT EXISTS "ProductionFactory_merchantId_name_key" ON "ProductionFactory"("merchantId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionFactory_inviteTokenHash_key" ON "ProductionFactory"("inviteTokenHash");
CREATE INDEX IF NOT EXISTS "ProductionFactory_merchantId_status_idx" ON "ProductionFactory"("merchantId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionFactoryMember_factoryId_email_key" ON "ProductionFactoryMember"("factoryId", "email");
CREATE INDEX IF NOT EXISTS "ProductionFactoryMember_email_idx" ON "ProductionFactoryMember"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrder_orderNo_key" ON "ProductionOrder"("orderNo");
CREATE INDEX IF NOT EXISTS "ProductionOrder_merchantId_status_dueDate_idx" ON "ProductionOrder"("merchantId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "ProductionOrder_factoryId_status_idx" ON "ProductionOrder"("factoryId", "status");
CREATE INDEX IF NOT EXISTS "ProductionOrder_productId_idx" ON "ProductionOrder"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrderItem_orderId_variantId_key" ON "ProductionOrderItem"("orderId", "variantId");
CREATE INDEX IF NOT EXISTS "ProductionOrderItem_orderId_idx" ON "ProductionOrderItem"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionBomSnapshot_orderId_materialId_key" ON "ProductionBomSnapshot"("orderId", "materialId");
CREATE INDEX IF NOT EXISTS "ProductionBomSnapshot_orderId_idx" ON "ProductionBomSnapshot"("orderId");
CREATE INDEX IF NOT EXISTS "ProductionOrderEvent_orderId_createdAt_idx" ON "ProductionOrderEvent"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductionOrderEvent_merchantId_createdAt_idx" ON "ProductionOrderEvent"("merchantId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionMaterialMovement_idempotencyKey_key" ON "ProductionMaterialMovement"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ProductionMaterialMovement_orderId_materialId_movementType_idx" ON "ProductionMaterialMovement"("orderId", "materialId", "movementType");
CREATE INDEX IF NOT EXISTS "ProductionMaterialMovement_factoryId_status_idx" ON "ProductionMaterialMovement"("factoryId", "status");
CREATE INDEX IF NOT EXISTS "ProductionMaterialMovement_merchantId_createdAt_idx" ON "ProductionMaterialMovement"("merchantId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionProgressReport_idempotencyKey_key" ON "ProductionProgressReport"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ProductionProgressReport_orderId_reportedAt_idx" ON "ProductionProgressReport"("orderId", "reportedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionDelivery_deliveryNo_key" ON "ProductionDelivery"("deliveryNo");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionDelivery_idempotencyKey_key" ON "ProductionDelivery"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ProductionDelivery_orderId_status_idx" ON "ProductionDelivery"("orderId", "status");
CREATE INDEX IF NOT EXISTS "ProductionDelivery_merchantId_submittedAt_idx" ON "ProductionDelivery"("merchantId", "submittedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionDeliveryItem_deliveryId_orderItemId_key" ON "ProductionDeliveryItem"("deliveryId", "orderItemId");
CREATE INDEX IF NOT EXISTS "ProductionDeliveryItem_deliveryId_idx" ON "ProductionDeliveryItem"("deliveryId");
CREATE INDEX IF NOT EXISTS "ProductionQualityInspection_deliveryId_createdAt_idx" ON "ProductionQualityInspection"("deliveryId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionReconciliation_reconciliationNo_key" ON "ProductionReconciliation"("reconciliationNo");
CREATE INDEX IF NOT EXISTS "ProductionReconciliation_merchantId_status_idx" ON "ProductionReconciliation"("merchantId", "status");
CREATE INDEX IF NOT EXISTS "ProductionReconciliation_orderId_version_idx" ON "ProductionReconciliation"("orderId", "version");
CREATE INDEX IF NOT EXISTS "ProductionReconciliationLine_reconciliationId_sortOrder_idx" ON "ProductionReconciliationLine"("reconciliationId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionPayment_idempotencyKey_key" ON "ProductionPayment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ProductionPayment_merchantId_paidAt_idx" ON "ProductionPayment"("merchantId", "paidAt");
CREATE INDEX IF NOT EXISTS "ProductionPayment_reconciliationId_idx" ON "ProductionPayment"("reconciliationId");

ALTER TABLE "ProductionFactory" DROP CONSTRAINT IF EXISTS "ProductionFactory_merchantId_fkey";
ALTER TABLE "ProductionFactory" ADD CONSTRAINT "ProductionFactory_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionFactoryMember" DROP CONSTRAINT IF EXISTS "ProductionFactoryMember_factoryId_fkey";
ALTER TABLE "ProductionFactoryMember" ADD CONSTRAINT "ProductionFactoryMember_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "ProductionFactory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" DROP CONSTRAINT IF EXISTS "ProductionOrder_merchantId_fkey";
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" DROP CONSTRAINT IF EXISTS "ProductionOrder_factoryId_fkey";
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "ProductionFactory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" DROP CONSTRAINT IF EXISTS "ProductionOrder_productId_fkey";
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrderItem" DROP CONSTRAINT IF EXISTS "ProductionOrderItem_orderId_fkey";
ALTER TABLE "ProductionOrderItem" ADD CONSTRAINT "ProductionOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOrderItem" DROP CONSTRAINT IF EXISTS "ProductionOrderItem_variantId_fkey";
ALTER TABLE "ProductionOrderItem" ADD CONSTRAINT "ProductionOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionBomSnapshot" DROP CONSTRAINT IF EXISTS "ProductionBomSnapshot_orderId_fkey";
ALTER TABLE "ProductionBomSnapshot" ADD CONSTRAINT "ProductionBomSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionBomSnapshot" DROP CONSTRAINT IF EXISTS "ProductionBomSnapshot_materialId_fkey";
ALTER TABLE "ProductionBomSnapshot" ADD CONSTRAINT "ProductionBomSnapshot_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrderEvent" DROP CONSTRAINT IF EXISTS "ProductionOrderEvent_orderId_fkey";
ALTER TABLE "ProductionOrderEvent" ADD CONSTRAINT "ProductionOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionMaterialMovement" DROP CONSTRAINT IF EXISTS "ProductionMaterialMovement_orderId_fkey";
ALTER TABLE "ProductionMaterialMovement" ADD CONSTRAINT "ProductionMaterialMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionMaterialMovement" DROP CONSTRAINT IF EXISTS "ProductionMaterialMovement_factoryId_fkey";
ALTER TABLE "ProductionMaterialMovement" ADD CONSTRAINT "ProductionMaterialMovement_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "ProductionFactory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionMaterialMovement" DROP CONSTRAINT IF EXISTS "ProductionMaterialMovement_materialId_fkey";
ALTER TABLE "ProductionMaterialMovement" ADD CONSTRAINT "ProductionMaterialMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionProgressReport" DROP CONSTRAINT IF EXISTS "ProductionProgressReport_orderId_fkey";
ALTER TABLE "ProductionProgressReport" ADD CONSTRAINT "ProductionProgressReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "ProductionDelivery" DROP CONSTRAINT IF EXISTS "ProductionDelivery_orderId_fkey";
ALTER TABLE "ProductionDelivery" ADD CONSTRAINT "ProductionDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionDeliveryItem" DROP CONSTRAINT IF EXISTS "ProductionDeliveryItem_deliveryId_fkey";
ALTER TABLE "ProductionDeliveryItem" ADD CONSTRAINT "ProductionDeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ProductionDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionDeliveryItem" DROP CONSTRAINT IF EXISTS "ProductionDeliveryItem_orderItemId_fkey";
ALTER TABLE "ProductionDeliveryItem" ADD CONSTRAINT "ProductionDeliveryItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "ProductionOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionQualityInspection" DROP CONSTRAINT IF EXISTS "ProductionQualityInspection_deliveryId_fkey";
ALTER TABLE "ProductionQualityInspection" ADD CONSTRAINT "ProductionQualityInspection_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ProductionDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionReconciliation" DROP CONSTRAINT IF EXISTS "ProductionReconciliation_orderId_fkey";
ALTER TABLE "ProductionReconciliation" ADD CONSTRAINT "ProductionReconciliation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionReconciliationLine" DROP CONSTRAINT IF EXISTS "ProductionReconciliationLine_reconciliationId_fkey";
ALTER TABLE "ProductionReconciliationLine" ADD CONSTRAINT "ProductionReconciliationLine_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "ProductionReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionPayment" DROP CONSTRAINT IF EXISTS "ProductionPayment_merchantId_fkey";
ALTER TABLE "ProductionPayment" ADD CONSTRAINT "ProductionPayment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionPayment" DROP CONSTRAINT IF EXISTS "ProductionPayment_reconciliationId_fkey";
ALTER TABLE "ProductionPayment" ADD CONSTRAINT "ProductionPayment_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "ProductionReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 应用商店目录（幂等）：分类 + 免费已发布应用
INSERT INTO "AppCategory" ("id", "name", "slug", "icon", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, '生产制造', 'manufacturing', 'Factory', 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "AppCategory" WHERE "slug" = 'manufacturing');

INSERT INTO "App" ("id", "appId", "name", "slug", "description", "detailedIntro", "icon", "categoryId", "version", "status", "pricingType", "pricePlan", "developer", "permissions", "features", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'ruda-production-chain',
  '智能生产链',
  'ruda-production-chain',
  '连接服装企业与加工厂，实现生产跟踪、物料管理、质量验收和在线对账。',
  '从商品选择、颜色尺码数量、加工厂邀请，到面辅料发料与工厂签收、进度汇报、分批交货验收、合格成衣入库、加工费对账与付款记录，全部围绕同一张生产单追溯，并复用 RUDA 现有商品、SKU、物料与库存数据。',
  'Factory',
  (SELECT "id" FROM "AppCategory" WHERE "slug" = 'manufacturing'),
  '1.0.0',
  'published',
  'free',
  '{}'::jsonb,
  'RUDA FASHION',
  '["production.view","production.manage"]',
  '["外发生产单","加工厂协同","面辅料交接","生产进度跟踪","分批交货及质检","加工费对账","成衣入库"]',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "App" WHERE "appId" = 'ruda-production-chain');

