ALTER TABLE "Product" ADD COLUMN "storeCategorySlug" TEXT;

UPDATE "Product" AS product
SET "storeCategorySlug" = product."category"
WHERE EXISTS (
  SELECT 1
  FROM "MerchantStoreCategory" AS store_category
  WHERE store_category."merchantId" = product."merchantId"
    AND store_category."slug" = product."category"
);
