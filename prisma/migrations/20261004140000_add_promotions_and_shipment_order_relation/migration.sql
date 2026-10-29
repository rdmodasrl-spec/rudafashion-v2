CREATE TABLE "PromotionRule" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "appliesOn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameIt" TEXT,
    "nameZh" TEXT,
    "description" TEXT,
    "minSubtotal" DECIMAL(12,2),
    "minQty" INTEGER,
    "percentOff" DECIMAL(5,2),
    "fixedAmountOff" DECIMAL(12,2),
    "buyQty" INTEGER,
    "getQty" INTEGER,
    "getPercentOff" DECIMAL(5,2),
    "tiersJson" TEXT,
    "merchantIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "categoryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "productIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "excludeSaleItems" BOOLEAN NOT NULL DEFAULT false,
    "usageLimitPerConsumer" INTEGER,
    "totalUsageLimit" INTEGER,
    "totalUsedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "consumerId" TEXT,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionRule_code_key" ON "PromotionRule"("code");
CREATE INDEX "PromotionRule_scope_isActive_startsAt_idx" ON "PromotionRule"("scope", "isActive", "startsAt");
CREATE INDEX "PromotionRule_createdAt_idx" ON "PromotionRule"("createdAt");
CREATE INDEX "CouponRedemption_orderId_idx" ON "CouponRedemption"("orderId");
CREATE INDEX "CouponRedemption_promotionId_redeemedAt_idx" ON "CouponRedemption"("promotionId", "redeemedAt");
CREATE UNIQUE INDEX "CouponRedemption_promotionId_orderId_code_key" ON "CouponRedemption"("promotionId", "orderId", "code");

ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "PromotionRule"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FulfillmentShipment"
    ADD CONSTRAINT "FulfillmentShipment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
    NOT VALID;

ALTER TABLE "FulfillmentShipment"
    VALIDATE CONSTRAINT "FulfillmentShipment_orderId_fkey";
