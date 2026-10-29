CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "vatNumber" TEXT,
    "registrationNumber" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_vatNumber_key" ON "Company"("vatNumber");
CREATE INDEX "Company_status_idx" ON "Company"("status");
CREATE INDEX "Company_country_city_idx" ON "Company"("country", "city");

CREATE TABLE "CompanyBusinessRole" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyBusinessRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyBusinessRole_companyId_role_key" ON "CompanyBusinessRole"("companyId", "role");
CREATE INDEX "CompanyBusinessRole_role_status_idx" ON "CompanyBusinessRole"("role", "status");
CREATE INDEX "CompanyBusinessRole_companyId_status_idx" ON "CompanyBusinessRole"("companyId", "status");
ALTER TABLE "CompanyBusinessRole" ADD CONSTRAINT "CompanyBusinessRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompanyVerification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "riskLevel" TEXT NOT NULL DEFAULT 'unknown',
    "provider" TEXT,
    "providerRef" TEXT,
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyVerification_companyId_key" ON "CompanyVerification"("companyId");
CREATE INDEX "CompanyVerification_status_riskLevel_idx" ON "CompanyVerification"("status", "riskLevel");
ALTER TABLE "CompanyVerification" ADD CONSTRAINT "CompanyVerification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompanyDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyDocument_companyId_documentType_idx" ON "CompanyDocument"("companyId", "documentType");
CREATE INDEX "CompanyDocument_companyId_status_idx" ON "CompanyDocument"("companyId", "status");
ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthAccount" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Merchant" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "companyId" TEXT;
ALTER TABLE "MerchantEmployee" ADD COLUMN "companyId" TEXT;

CREATE INDEX "AuthAccount_companyId_idx" ON "AuthAccount"("companyId");
CREATE INDEX "Merchant_companyId_idx" ON "Merchant"("companyId");
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");
CREATE INDEX "MerchantEmployee_companyId_active_idx" ON "MerchantEmployee"("companyId", "active");

ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantEmployee" ADD CONSTRAINT "MerchantEmployee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
