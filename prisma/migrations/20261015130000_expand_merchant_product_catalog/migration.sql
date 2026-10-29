ALTER TABLE "Product"
  ADD COLUMN "bulkPriceMinimumQuantity" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "requiresFullCarton" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "manufacturingProcess" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "fit" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Product"
  ADD COLUMN "creationRequestKey" TEXT;

CREATE UNIQUE INDEX "Product_creationRequestKey_key" ON "Product"("creationRequestKey");

ALTER TABLE "OrderItem"
  ADD COLUMN "pricingSnapshot" TEXT;
