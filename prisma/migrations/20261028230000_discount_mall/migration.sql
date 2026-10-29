-- Discount mall display state (additive, nullable/defaulted, no backfill).
-- Merchant product mallStatus is independent from Product.lifecycleStatus and
-- Product.status: platform unlisting must never unpublish a merchant store product.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallStatus" TEXT NOT NULL DEFAULT 'not_listed';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallStatusReason" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallListedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallUnlistedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallListedBy" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallUnlistedBy" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallReviewedBy" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallReviewedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallSortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallSaleStartsAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallSaleEndsAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mallUpdatedBy" TEXT;

CREATE INDEX IF NOT EXISTS "Product_mallStatus_mallSortOrder_idx"
  ON "Product"("mallStatus", "mallSortOrder");
