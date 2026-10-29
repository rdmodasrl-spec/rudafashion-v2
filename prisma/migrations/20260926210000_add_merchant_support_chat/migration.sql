CREATE TABLE "MerchantSupportConversation" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantSupportConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantSupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MerchantSupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MerchantSupportConversation_merchantId_updatedAt_idx" ON "MerchantSupportConversation"("merchantId", "updatedAt");
CREATE INDEX "MerchantSupportConversation_status_lastMessageAt_idx" ON "MerchantSupportConversation"("status", "lastMessageAt");
CREATE INDEX "MerchantSupportMessage_conversationId_createdAt_idx" ON "MerchantSupportMessage"("conversationId", "createdAt");
CREATE INDEX "MerchantSupportMessage_isRead_senderRole_idx" ON "MerchantSupportMessage"("isRead", "senderRole");

ALTER TABLE "MerchantSupportConversation"
ADD CONSTRAINT "MerchantSupportConversation_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantSupportMessage"
ADD CONSTRAINT "MerchantSupportMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "MerchantSupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
