CREATE TABLE "MerchantLeatherStudioProject" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "studioCode" VARCHAR(32) NOT NULL DEFAULT 'leather_studio',
  "industryTemplate" VARCHAR(48) NOT NULL DEFAULT 'bags_wholesale',
  "clientRequestId" VARCHAR(160) NOT NULL,
  "requestPayloadHash" VARCHAR(64) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantLeatherStudioProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantLeatherStudioProjectVersion" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "actorId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantLeatherStudioProjectVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantLeatherStudioProject_merchantId_clientRequestId_key"
  ON "MerchantLeatherStudioProject"("merchantId", "clientRequestId");
CREATE INDEX "MerchantLeatherStudioProject_merchantId_createdAt_id_idx"
  ON "MerchantLeatherStudioProject"("merchantId", "createdAt", "id");
CREATE INDEX "MerchantLeatherStudioProject_merchantId_status_updatedAt_idx"
  ON "MerchantLeatherStudioProject"("merchantId", "status", "updatedAt");
CREATE UNIQUE INDEX "MerchantLeatherStudioProjectVersion_projectId_revision_key"
  ON "MerchantLeatherStudioProjectVersion"("projectId", "revision");
CREATE INDEX "MerchantLeatherStudioProjectVersion_projectId_createdAt_idx"
  ON "MerchantLeatherStudioProjectVersion"("projectId", "createdAt");

ALTER TABLE "MerchantLeatherStudioProject"
  ADD CONSTRAINT "MerchantLeatherStudioProject_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantLeatherStudioProjectVersion"
  ADD CONSTRAINT "MerchantLeatherStudioProjectVersion_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "MerchantLeatherStudioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
