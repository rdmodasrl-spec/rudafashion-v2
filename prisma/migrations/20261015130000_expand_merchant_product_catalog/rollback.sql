ALTER TABLE "OrderItem"
  DROP COLUMN "pricingSnapshot";

DROP INDEX "Product_creationRequestKey_key";

ALTER TABLE "Product"
  DROP COLUMN "creationRequestKey",
  DROP COLUMN "fit",
  DROP COLUMN "manufacturingProcess",
  DROP COLUMN "requiresFullCarton",
  DROP COLUMN "bulkPriceMinimumQuantity";
