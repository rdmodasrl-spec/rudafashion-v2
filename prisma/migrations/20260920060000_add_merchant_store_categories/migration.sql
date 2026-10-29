CREATE TABLE "MerchantStoreCategory" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantStoreCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantStoreCategory_merchantId_slug_key"
  ON "MerchantStoreCategory"("merchantId", "slug");
CREATE INDEX "MerchantStoreCategory_merchantId_isActive_sortOrder_idx"
  ON "MerchantStoreCategory"("merchantId", "isActive", "sortOrder");

ALTER TABLE "MerchantStoreCategory"
  ADD CONSTRAINT "MerchantStoreCategory_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MerchantStoreCategory" ("id", "merchantId", "name", "slug", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, product."merchantId", product."category", product."category", 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" AS product
WHERE product."merchantId" IS NOT NULL
GROUP BY product."merchantId", product."category"
ON CONFLICT ("merchantId", "slug") DO NOTHING;
