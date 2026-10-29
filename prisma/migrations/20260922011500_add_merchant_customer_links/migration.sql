CREATE TABLE "MerchantCustomerLink" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantCustomerLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantCustomerLink_merchantId_customerId_key" ON "MerchantCustomerLink"("merchantId", "customerId");
CREATE INDEX "MerchantCustomerLink_merchantId_updatedAt_idx" ON "MerchantCustomerLink"("merchantId", "updatedAt");

ALTER TABLE "MerchantCustomerLink" ADD CONSTRAINT "MerchantCustomerLink_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantCustomerLink" ADD CONSTRAINT "MerchantCustomerLink_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
