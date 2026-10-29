CREATE TABLE "OrderMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderMessage_orderId_clientMessageId_key"
ON "OrderMessage"("orderId", "clientMessageId");

CREATE INDEX "OrderMessage_orderId_createdAt_id_idx"
ON "OrderMessage"("orderId", "createdAt", "id");

CREATE INDEX "OrderMessage_orderId_senderRole_readAt_idx"
ON "OrderMessage"("orderId", "senderRole", "readAt");

ALTER TABLE "OrderMessage"
ADD CONSTRAINT "OrderMessage_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
