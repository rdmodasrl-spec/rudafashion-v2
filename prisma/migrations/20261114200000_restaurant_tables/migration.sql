CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "area" VARCHAR(80) NOT NULL DEFAULT '',
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" VARCHAR(160),
    "requestHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantTable_merchantId_storeId_code_key"
    ON "RestaurantTable"("merchantId", "storeId", "code");
CREATE UNIQUE INDEX "RestaurantTable_merchantId_idempotencyKey_key"
    ON "RestaurantTable"("merchantId", "idempotencyKey");
CREATE INDEX "RestaurantTable_merchantId_storeId_status_code_idx"
    ON "RestaurantTable"("merchantId", "storeId", "status", "code");

ALTER TABLE "RestaurantTable"
    ADD CONSTRAINT "RestaurantTable_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantTable"
    ADD CONSTRAINT "RestaurantTable_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "MerchantStore"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
