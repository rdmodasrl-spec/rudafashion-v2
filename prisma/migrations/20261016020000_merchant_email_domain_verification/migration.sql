CREATE TABLE "MerchantEmailDomain" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "domainName" VARCHAR(253) NOT NULL,
    "verificationToken" VARCHAR(128) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantEmailDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantEmailDomain_merchantId_domainName_key"
ON "MerchantEmailDomain"("merchantId", "domainName");

CREATE INDEX "MerchantEmailDomain_merchantId_verifiedAt_idx"
ON "MerchantEmailDomain"("merchantId", "verifiedAt");

ALTER TABLE "MerchantEmailDomain"
ADD CONSTRAINT "MerchantEmailDomain_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
