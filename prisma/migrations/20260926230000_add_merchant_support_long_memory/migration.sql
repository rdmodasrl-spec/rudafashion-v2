CREATE TABLE "MerchantSupportMemory" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "embedding" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantSupportMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantSupportMemory_conversationId_key"
ON "MerchantSupportMemory"("conversationId");
CREATE INDEX "MerchantSupportMemory_merchantId_updatedAt_idx"
ON "MerchantSupportMemory"("merchantId", "updatedAt");

ALTER TABLE "MerchantSupportMemory"
ADD CONSTRAINT "MerchantSupportMemory_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantSupportMemory"
ADD CONSTRAINT "MerchantSupportMemory_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "MerchantSupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
