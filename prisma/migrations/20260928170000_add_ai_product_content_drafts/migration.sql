CREATE TABLE "AiEmployeeProductContentDraft" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "language" VARCHAR(8) NOT NULL,
    "sourceTitle" TEXT,
    "sourceDescription" TEXT,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiEmployeeProductContentDraft_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiEmployeeProductContentDraft_status_check"
        CHECK ("status" IN ('pending', 'applied', 'rejected', 'superseded', 'stale')),
    CONSTRAINT "AiEmployeeProductContentDraft_language_check"
        CHECK ("language" IN ('zh', 'it', 'en'))
);

CREATE INDEX "AiEmployeeProductContentDraft_merchantId_status_createdAt_idx"
ON "AiEmployeeProductContentDraft"("merchantId", "status", "createdAt");

CREATE INDEX "AiEmployeeProductContentDraft_installationId_productId_language_status_idx"
ON "AiEmployeeProductContentDraft"("installationId", "productId", "language", "status");

ALTER TABLE "AiEmployeeProductContentDraft"
ADD CONSTRAINT "AiEmployeeProductContentDraft_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiEmployeeProductContentDraft"
ADD CONSTRAINT "AiEmployeeProductContentDraft_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "MerchantAiEmployeeInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiEmployeeProductContentDraft"
ADD CONSTRAINT "AiEmployeeProductContentDraft_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
