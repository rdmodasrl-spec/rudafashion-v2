CREATE TABLE "MerchantWorkspaceDraft" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "workspace" VARCHAR(24) NOT NULL,
    "document" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantWorkspaceDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantWorkspaceDraft_merchantId_workspace_key"
ON "MerchantWorkspaceDraft"("merchantId", "workspace");

CREATE INDEX "MerchantWorkspaceDraft_merchantId_updatedAt_idx"
ON "MerchantWorkspaceDraft"("merchantId", "updatedAt");

ALTER TABLE "MerchantWorkspaceDraft"
ADD CONSTRAINT "MerchantWorkspaceDraft_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
