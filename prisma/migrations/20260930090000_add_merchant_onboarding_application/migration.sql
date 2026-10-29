CREATE TABLE "MerchantOnboardingApplication" (
    "id" TEXT NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "companyLegalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "vatNumber" TEXT NOT NULL,
    "taxCode" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "zip" TEXT,
    "contactPerson" TEXT NOT NULL,
    "contactPosition" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT,
    "wechat" TEXT,
    "websiteOrSocial" TEXT,
    "businessType" TEXT NOT NULL,
    "merchantZone" TEXT NOT NULL,
    "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "yearsInBusiness" INTEGER,
    "annualRevenueRange" TEXT,
    "showroomAddress" TEXT,
    "bankName" TEXT,
    "ibanLast4" TEXT,
    "description" TEXT,
    "documentsJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "adminReviewNotes" TEXT,
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedMerchantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantOnboardingApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantOnboardingApplication_applicationNo_key"
ON "MerchantOnboardingApplication"("applicationNo");

CREATE INDEX "MerchantOnboardingApplication_status_idx"
ON "MerchantOnboardingApplication"("status");

CREATE INDEX "MerchantOnboardingApplication_vatNumber_idx"
ON "MerchantOnboardingApplication"("vatNumber");

CREATE INDEX "MerchantOnboardingApplication_merchantZone_idx"
ON "MerchantOnboardingApplication"("merchantZone");

CREATE INDEX "MerchantOnboardingApplication_applicationNo_idx"
ON "MerchantOnboardingApplication"("applicationNo");
