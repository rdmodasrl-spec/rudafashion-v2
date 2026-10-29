ALTER TABLE "Order"
  ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "promotionCode" TEXT;

ALTER TABLE "CouponRedemption"
  ADD COLUMN "parentOrderNo" TEXT;

ALTER TABLE "OrderInvoice"
  ADD COLUMN "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE INDEX "CouponRedemption_promotionId_consumerId_parentOrderNo_idx"
  ON "CouponRedemption"("promotionId", "consumerId", "parentOrderNo");
