CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "color" TEXT,
    "size" TEXT,
    "attributes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "onHandQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "inTransitQuantity" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "movementType" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "operatorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVariant_productId_sku_key" ON "ProductVariant"("productId", "sku");
CREATE INDEX "ProductVariant_sku_idx" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_barcode_idx" ON "ProductVariant"("barcode");
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

CREATE UNIQUE INDEX "WarehouseLocation_merchantId_code_key" ON "WarehouseLocation"("merchantId", "code");
CREATE INDEX "WarehouseLocation_type_isActive_idx" ON "WarehouseLocation"("type", "isActive");
CREATE INDEX "WarehouseLocation_merchantId_idx" ON "WarehouseLocation"("merchantId");

CREATE UNIQUE INDEX "InventoryBalance_variantId_locationId_key" ON "InventoryBalance"("variantId", "locationId");
CREATE INDEX "InventoryBalance_merchantId_locationId_idx" ON "InventoryBalance"("merchantId", "locationId");
CREATE INDEX "InventoryBalance_variantId_idx" ON "InventoryBalance"("variantId");

CREATE UNIQUE INDEX "InventoryMovement_idempotencyKey_key" ON "InventoryMovement"("idempotencyKey");
CREATE INDEX "InventoryMovement_variantId_locationId_createdAt_idx" ON "InventoryMovement"("variantId", "locationId", "createdAt");
CREATE INDEX "InventoryMovement_merchantId_createdAt_idx" ON "InventoryMovement"("merchantId", "createdAt");
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");
CREATE INDEX "InventoryMovement_movementType_createdAt_idx" ON "InventoryMovement"("movementType", "createdAt");

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing catalog stock while the application transitions from the
-- legacy Product.skus JSON document to normalized variants and balances.
INSERT INTO "WarehouseLocation" ("id", "code", "name", "type", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, location.code, location.name, location.type, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('central', 'Central Warehouse', 'central'),
  ('mestre', 'Mestre Showroom', 'showroom'),
  ('milano', 'Milano Showroom', 'showroom')
) AS location(code, name, type)
WHERE NOT EXISTS (
  SELECT 1 FROM "WarehouseLocation"
  WHERE "merchantId" IS NULL AND "code" = location.code
);

INSERT INTO "ProductVariant" (
  "id", "productId", "sku", "barcode", "color", "size", "attributes", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  product."id",
  sku.value->>'sku',
  NULLIF(sku.value->>'barcode', ''),
  NULLIF(sku.value->>'color', ''),
  NULLIF(sku.value->>'size', ''),
  sku.value::text,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" AS product
CROSS JOIN LATERAL jsonb_array_elements(product."skus"::jsonb) AS sku(value)
WHERE NULLIF(sku.value->>'sku', '') IS NOT NULL
ON CONFLICT ("productId", "sku") DO NOTHING;

INSERT INTO "InventoryBalance" (
  "id", "merchantId", "variantId", "locationId", "onHandQuantity", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  product."merchantId",
  variant."id",
  location."id",
  CASE location."code"
    WHEN 'central' THEN COALESCE((sku.value->>'stockCentral')::integer, 0)
    WHEN 'mestre' THEN COALESCE((sku.value->>'stockMestre')::integer, 0)
    WHEN 'milano' THEN COALESCE((sku.value->>'stockMilano')::integer, 0)
    ELSE 0
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" AS product
CROSS JOIN LATERAL jsonb_array_elements(product."skus"::jsonb) AS sku(value)
JOIN "ProductVariant" AS variant
  ON variant."productId" = product."id" AND variant."sku" = sku.value->>'sku'
JOIN "WarehouseLocation" AS location
  ON location."merchantId" IS NULL AND location."code" IN ('central', 'mestre', 'milano')
ON CONFLICT ("variantId", "locationId") DO NOTHING;
