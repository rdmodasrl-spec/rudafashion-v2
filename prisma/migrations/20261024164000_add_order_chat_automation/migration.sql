ALTER TABLE "OrderMessage"
  ALTER COLUMN "senderId" DROP NOT NULL,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'human',
  ADD COLUMN "replyToMessageId" TEXT,
  ADD COLUMN "requiresMerchantReply" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "merchantRepliedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "OrderMessage_replyToMessageId_key"
ON "OrderMessage"("replyToMessageId");

CREATE INDEX "OrderMessage_orderId_requiresMerchantReply_merchantRepliedAt_idx"
ON "OrderMessage"("orderId", "requiresMerchantReply", "merchantRepliedAt");

ALTER TABLE "OrderMessage"
ADD CONSTRAINT "OrderMessage_replyToMessageId_fkey"
FOREIGN KEY ("replyToMessageId") REFERENCES "OrderMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
