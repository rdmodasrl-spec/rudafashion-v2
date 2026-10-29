ALTER TABLE "Company" ADD COLUMN "phone" TEXT;
ALTER TABLE "CompanyVerification" ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Company_phone_key" ON "Company"("phone");
