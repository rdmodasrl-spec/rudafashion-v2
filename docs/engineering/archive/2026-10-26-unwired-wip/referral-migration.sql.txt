CREATE TABLE "MerchantGrowthReferral" (
  "id" TEXT NOT NULL,
  "referrerMerchantId" TEXT NOT NULL,
  "referredMerchantId" TEXT NOT NULL,
  "referralCodeSnapshot" VARCHAR(120) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "qualificationDeadline" TIMESTAMP(3) NOT NULL,
  "qualifiedAt" TIMESTAMP(3),
  "rewardBenefitId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantGrowthReferral_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantGrowthReferral_status_check"
    CHECK ("status" IN ('pending', 'qualified', 'expired', 'disqualified'))
);

CREATE UNIQUE INDEX "MerchantGrowthReferral_referredMerchantId_key"
  ON "MerchantGrowthReferral"("referredMerchantId");
CREATE UNIQUE INDEX "MerchantGrowthReferral_rewardBenefitId_key"
  ON "MerchantGrowthReferral"("rewardBenefitId");
CREATE INDEX "MerchantGrowthReferral_referrerMerchantId_status_createdAt_idx"
  ON "MerchantGrowthReferral"("referrerMerchantId", "status", "createdAt");
CREATE INDEX "MerchantGrowthReferral_status_qualificationDeadline_idx"
  ON "MerchantGrowthReferral"("status", "qualificationDeadline");
ALTER TABLE "MerchantGrowthReferral" ADD CONSTRAINT "MerchantGrowthReferral_referrerMerchantId_fkey"
  FOREIGN KEY ("referrerMerchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantGrowthReferral" ADD CONSTRAINT "MerchantGrowthReferral_referredMerchantId_fkey"
  FOREIGN KEY ("referredMerchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MerchantPromotionBenefit" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "sourceMerchantId" TEXT,
  "sourceType" VARCHAR(32) NOT NULL,
  "sourceId" VARCHAR(160) NOT NULL,
  "planId" VARCHAR(32) NOT NULL DEFAULT 'PLUS',
  "months" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'applied',
  "subscriptionId" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantPromotionBenefit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantPromotionBenefit_months_check" CHECK ("months" BETWEEN 1 AND 120),
  CONSTRAINT "MerchantPromotionBenefit_status_check"
    CHECK ("status" IN ('scheduled', 'applied', 'expired')),
  CONSTRAINT "MerchantPromotionBenefit_source_check"
    CHECK ("sourceType" IN ('registration_trial', 'merchant_referral'))
);

CREATE UNIQUE INDEX "MerchantPromotionBenefit_idempotencyKey_key"
  ON "MerchantPromotionBenefit"("idempotencyKey");
CREATE INDEX "MerchantPromotionBenefit_merchantId_status_startsAt_idx"
  ON "MerchantPromotionBenefit"("merchantId", "status", "startsAt");
CREATE INDEX "MerchantPromotionBenefit_sourceMerchantId_sourceType_createdAt_idx"
  ON "MerchantPromotionBenefit"("sourceMerchantId", "sourceType", "createdAt");
CREATE INDEX "MerchantPromotionBenefit_subscriptionId_idx"
  ON "MerchantPromotionBenefit"("subscriptionId");
ALTER TABLE "MerchantPromotionBenefit" ADD CONSTRAINT "MerchantPromotionBenefit_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantPromotionBenefit" ADD CONSTRAINT "MerchantPromotionBenefit_sourceMerchantId_fkey"
  FOREIGN KEY ("sourceMerchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantPromotionBenefit" ADD CONSTRAINT "MerchantPromotionBenefit_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "ModaGptBillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
