CREATE UNIQUE INDEX "MerchantStudioProject_id_merchantId_key"
  ON "MerchantStudioProject"("id", "merchantId");

CREATE TABLE "MerchantStudioProjectFile" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "actorId" VARCHAR(160) NOT NULL,
  "clientRequestId" VARCHAR(160) NOT NULL,
  "requestPayloadHash" VARCHAR(64) NOT NULL,
  "storageBucket" VARCHAR(128) NOT NULL,
  "storageKey" VARCHAR(512) NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(120) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending_upload',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploadedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "MerchantStudioProjectFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantStudioProjectFile_merchantId_projectId_clientRequestId_key"
  ON "MerchantStudioProjectFile"("merchantId", "projectId", "clientRequestId");
CREATE UNIQUE INDEX "MerchantStudioProjectFile_merchantId_storageKey_key"
  ON "MerchantStudioProjectFile"("merchantId", "storageKey");
CREATE INDEX "MerchantStudioProjectFile_merchantId_projectId_status_createdAt_idx"
  ON "MerchantStudioProjectFile"("merchantId", "projectId", "status", "createdAt");

ALTER TABLE "MerchantStudioProjectFile"
  ADD CONSTRAINT "MerchantStudioProjectFile_projectId_merchantId_fkey"
  FOREIGN KEY ("projectId", "merchantId")
  REFERENCES "MerchantStudioProject"("id", "merchantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModaGptTask"
  ADD COLUMN "projectId" TEXT;

CREATE INDEX "ModaGptTask_merchantId_projectId_createdAt_idx"
  ON "ModaGptTask"("merchantId", "projectId", "createdAt");

ALTER TABLE "ModaGptTask"
  ADD CONSTRAINT "ModaGptTask_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "MerchantStudioProject"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
