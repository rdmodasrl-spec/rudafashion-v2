ALTER TABLE "MerchantOnboardingApplication"
ADD COLUMN "accountIdentityId" TEXT,
ADD COLUMN "companyId" TEXT,
ADD COLUMN "industryTemplate" VARCHAR(48),
ADD COLUMN "industryTemplateSource" VARCHAR(32) NOT NULL DEFAULT 'SELF_SELECTED',
ADD COLUMN "registrationProfile" JSONB,
ADD COLUMN "submittedByAuthAccountId" TEXT;

ALTER TABLE "MerchantOnboardingApplication"
ALTER COLUMN "status" SET DEFAULT 'pending_review';

UPDATE "MerchantOnboardingApplication"
SET "status" = 'pending_review'
WHERE "status" IN ('submitted', 'reviewing');

CREATE INDEX "MerchantOnboardingApplication_accountIdentityId_idx"
ON "MerchantOnboardingApplication"("accountIdentityId");

CREATE INDEX "MerchantOnboardingApplication_companyId_idx"
ON "MerchantOnboardingApplication"("companyId");

CREATE INDEX "MerchantOnboardingApplication_industryTemplate_idx"
ON "MerchantOnboardingApplication"("industryTemplate");
