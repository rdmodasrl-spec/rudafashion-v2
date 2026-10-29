CREATE TABLE "AiEmployeeCreativeDraft" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "productId" TEXT,
    "prompt" VARCHAR(1000) NOT NULL,
    "image" BYTEA NOT NULL,
    "imageMime" VARCHAR(32) NOT NULL DEFAULT 'image/webp',
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'pending_review',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiEmployeeCreativeDraft_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiEmployeeCreativeDraft_status_check"
      CHECK ("status" IN ('pending_review', 'approved', 'rejected'))
);

CREATE INDEX "AiEmployeeCreativeDraft_merchantId_status_createdAt_idx"
ON "AiEmployeeCreativeDraft"("merchantId", "status", "createdAt");

CREATE INDEX "AiEmployeeCreativeDraft_installationId_status_createdAt_idx"
ON "AiEmployeeCreativeDraft"("installationId", "status", "createdAt");

ALTER TABLE "AiEmployeeCreativeDraft"
ADD CONSTRAINT "AiEmployeeCreativeDraft_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiEmployeeCreativeDraft"
ADD CONSTRAINT "AiEmployeeCreativeDraft_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "MerchantAiEmployeeInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiEmployeeCreativeDraft"
ADD CONSTRAINT "AiEmployeeCreativeDraft_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
