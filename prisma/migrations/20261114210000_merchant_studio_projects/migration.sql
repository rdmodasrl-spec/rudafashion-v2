CREATE TABLE "MerchantStudioProject" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "studioCode" VARCHAR(32) NOT NULL,
  "industryTemplate" VARCHAR(48) NOT NULL,
  "clientRequestId" VARCHAR(160) NOT NULL,
  "requestPayloadHash" VARCHAR(64) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantStudioProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantStudioProjectVersion" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "actorId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantStudioProjectVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantStudioProject_merchantId_studioCode_clientRequestId_key"
  ON "MerchantStudioProject"("merchantId", "studioCode", "clientRequestId");
CREATE INDEX "MerchantStudioProject_merchantId_studioCode_createdAt_id_idx"
  ON "MerchantStudioProject"("merchantId", "studioCode", "createdAt", "id");
CREATE INDEX "MerchantStudioProject_status_updated_idx"
  ON "MerchantStudioProject"("merchantId", "studioCode", "status", "updatedAt");
CREATE UNIQUE INDEX "MerchantStudioProjectVersion_projectId_revision_key"
  ON "MerchantStudioProjectVersion"("projectId", "revision");
CREATE INDEX "MerchantStudioProjectVersion_projectId_createdAt_idx"
  ON "MerchantStudioProjectVersion"("projectId", "createdAt");

ALTER TABLE "MerchantStudioProject"
  ADD CONSTRAINT "MerchantStudioProject_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantStudioProjectVersion"
  ADD CONSTRAINT "MerchantStudioProjectVersion_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "MerchantStudioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MerchantStudioProject" (
  "id", "merchantId", "actorId", "studioCode", "industryTemplate", "clientRequestId",
  "requestPayloadHash", "title", "status", "revision", "payload", "createdAt", "updatedAt"
)
SELECT
  "id", "merchantId", "actorId", "studioCode", "industryTemplate", "clientRequestId",
  "requestPayloadHash", "title", "status", "revision", "payload", "createdAt", "updatedAt"
FROM "MerchantLeatherStudioProject";

INSERT INTO "MerchantStudioProjectVersion" (
  "id", "projectId", "revision", "actorId", "payload", "title", "createdAt"
)
SELECT
  "id", "projectId", "revision", "actorId", "payload", "title", "createdAt"
FROM "MerchantLeatherStudioProjectVersion";
