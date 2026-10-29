CREATE TABLE "MerchantModaGptImageTask" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "task" VARCHAR(24) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'processing',
    "resultStorageKey" VARCHAR(512),
    "resultStorageBucket" VARCHAR(160),
    "errorCode" VARCHAR(80),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantModaGptImageTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantModaGptImageTask_merchantId_idempotencyKey_key"
ON "MerchantModaGptImageTask"("merchantId", "idempotencyKey");

CREATE INDEX "MerchantModaGptImageTask_status_expiresAt_idx"
ON "MerchantModaGptImageTask"("status", "expiresAt");

CREATE INDEX "MerchantModaGptImageTask_merchantId_createdAt_idx"
ON "MerchantModaGptImageTask"("merchantId", "createdAt");

ALTER TABLE "MerchantModaGptImageTask"
ADD CONSTRAINT "MerchantModaGptImageTask_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
