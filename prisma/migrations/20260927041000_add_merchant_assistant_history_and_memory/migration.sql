CREATE TABLE "MerchantAssistantConversation" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantAssistantConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantAssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT 'dashboard',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantAssistantMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantAssistantMemory" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantAssistantMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MerchantAssistantConversation_merchantId_actorId_updatedAt_idx"
ON "MerchantAssistantConversation"("merchantId", "actorId", "updatedAt");

CREATE INDEX "MerchantAssistantMessage_conversationId_createdAt_idx"
ON "MerchantAssistantMessage"("conversationId", "createdAt");

CREATE INDEX "MerchantAssistantMemory_merchantId_actorId_updatedAt_idx"
ON "MerchantAssistantMemory"("merchantId", "actorId", "updatedAt");

ALTER TABLE "MerchantAssistantConversation"
ADD CONSTRAINT "MerchantAssistantConversation_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantAssistantMessage"
ADD CONSTRAINT "MerchantAssistantMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "MerchantAssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantAssistantMemory"
ADD CONSTRAINT "MerchantAssistantMemory_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
