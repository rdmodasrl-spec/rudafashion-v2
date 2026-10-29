CREATE TABLE "MerchantAiEmployeeMemory" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "category" VARCHAR(24) NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantAiEmployeeMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MerchantAiEmployeeMemory_merchantId_category_updatedAt_idx"
ON "MerchantAiEmployeeMemory"("merchantId", "category", "updatedAt");

ALTER TABLE "MerchantAiEmployeeMemory"
ADD CONSTRAINT "MerchantAiEmployeeMemory_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
