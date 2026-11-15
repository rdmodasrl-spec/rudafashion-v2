CREATE TABLE "RestaurantDish" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "nameZh" VARCHAR(160),
    "nameIt" VARCHAR(160),
    "category" VARCHAR(96) NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "allergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" VARCHAR(160),
    "requestHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestaurantDish_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantMenu" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "storeId" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" VARCHAR(160),
    "requestHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestaurantMenu_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantMenuItem" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'available',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestaurantMenuItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantDish_merchantId_idempotencyKey_key"
    ON "RestaurantDish"("merchantId", "idempotencyKey");
CREATE INDEX "RestaurantDish_merchantId_status_updatedAt_idx"
    ON "RestaurantDish"("merchantId", "status", "updatedAt");
CREATE INDEX "RestaurantDish_productId_idx" ON "RestaurantDish"("productId");

CREATE UNIQUE INDEX "RestaurantMenu_merchantId_idempotencyKey_key"
    ON "RestaurantMenu"("merchantId", "idempotencyKey");
CREATE INDEX "RestaurantMenu_merchantId_status_updatedAt_idx"
    ON "RestaurantMenu"("merchantId", "status", "updatedAt");
CREATE INDEX "RestaurantMenu_storeId_status_idx" ON "RestaurantMenu"("storeId", "status");

CREATE UNIQUE INDEX "RestaurantMenuItem_menuId_dishId_key"
    ON "RestaurantMenuItem"("menuId", "dishId");
CREATE INDEX "RestaurantMenuItem_merchantId_menuId_status_sortOrder_idx"
    ON "RestaurantMenuItem"("merchantId", "menuId", "status", "sortOrder");
CREATE INDEX "RestaurantMenuItem_dishId_idx" ON "RestaurantMenuItem"("dishId");

ALTER TABLE "RestaurantDish"
    ADD CONSTRAINT "RestaurantDish_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantDish"
    ADD CONSTRAINT "RestaurantDish_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RestaurantMenu"
    ADD CONSTRAINT "RestaurantMenu_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantMenu"
    ADD CONSTRAINT "RestaurantMenu_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "MerchantStore"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RestaurantMenuItem"
    ADD CONSTRAINT "RestaurantMenuItem_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantMenuItem"
    ADD CONSTRAINT "RestaurantMenuItem_menuId_fkey"
    FOREIGN KEY ("menuId") REFERENCES "RestaurantMenu"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantMenuItem"
    ADD CONSTRAINT "RestaurantMenuItem_dishId_fkey"
    FOREIGN KEY ("dishId") REFERENCES "RestaurantDish"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
