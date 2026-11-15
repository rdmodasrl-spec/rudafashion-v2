ALTER TABLE "Merchant"
  ADD COLUMN "formalIndustryId" VARCHAR(48);

CREATE INDEX "Merchant_formalIndustryId_idx"
  ON "Merchant"("formalIndustryId");

ALTER TABLE "MerchantStudioEntitlement"
  ADD COLUMN "formalIndustryId" VARCHAR(48);

CREATE UNIQUE INDEX "MerchantStudioEntitlement_merchant_formalIndustryId_key"
  ON "MerchantStudioEntitlement"("merchantId", "formalIndustryId");

ALTER TABLE "MerchantOnboardingApplication"
  ADD COLUMN "formalIndustryId" VARCHAR(48),
  ADD COLUMN "industryCapabilityIds" JSONB;
