CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "country" TEXT,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Supplier_merchantId_name_key" ON "Supplier"("merchantId", "name");
CREATE INDEX "Supplier_merchantId_status_idx" ON "Supplier"("merchantId", "status");
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "supplierId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'meter',
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reorderPoint" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Material_merchantId_code_key" ON "Material"("merchantId", "code");
CREATE INDEX "Material_merchantId_category_status_idx" ON "Material"("merchantId", "category", "status");
CREATE INDEX "Material_supplierId_idx" ON "Material"("supplierId");
ALTER TABLE "Material" ADD CONSTRAINT "Material_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MaterialInventoryBalance" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "onHandQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reservedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaterialInventoryBalance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialInventoryBalance_materialId_locationId_key" ON "MaterialInventoryBalance"("materialId", "locationId");
CREATE INDEX "MaterialInventoryBalance_merchantId_locationId_idx" ON "MaterialInventoryBalance"("merchantId", "locationId");
ALTER TABLE "MaterialInventoryBalance" ADD CONSTRAINT "MaterialInventoryBalance_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialInventoryBalance" ADD CONSTRAINT "MaterialInventoryBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MaterialInventoryMovement" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "movementType" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "operatorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialInventoryMovement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialInventoryMovement_idempotencyKey_key" ON "MaterialInventoryMovement"("idempotencyKey");
CREATE INDEX "MaterialInventoryMovement_merchantId_createdAt_idx" ON "MaterialInventoryMovement"("merchantId", "createdAt");
CREATE INDEX "MaterialInventoryMovement_materialId_locationId_createdAt_idx" ON "MaterialInventoryMovement"("materialId", "locationId", "createdAt");
CREATE INDEX "MaterialInventoryMovement_referenceType_referenceId_idx" ON "MaterialInventoryMovement"("referenceType", "referenceId");
ALTER TABLE "MaterialInventoryMovement" ADD CONSTRAINT "MaterialInventoryMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialInventoryMovement" ADD CONSTRAINT "MaterialInventoryMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductBomItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(14,4) NOT NULL,
    "wasteRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductBomItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductBomItem_productId_materialId_key" ON "ProductBomItem"("productId", "materialId");
CREATE INDEX "ProductBomItem_materialId_idx" ON "ProductBomItem"("materialId");
ALTER TABLE "ProductBomItem" ADD CONSTRAINT "ProductBomItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBomItem" ADD CONSTRAINT "ProductBomItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
