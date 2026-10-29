CREATE TABLE "FashionStudioProject" (
    "id" TEXT NOT NULL,
    "tenantId" VARCHAR(80) NOT NULL DEFAULT 'platform',
    "title" VARCHAR(120) NOT NULL,
    "sourcePostId" VARCHAR(120) NOT NULL,
    "document" TEXT NOT NULL,
    "createdBy" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionStudioProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FashionStudioProject_tenantId_updatedAt_idx" ON "FashionStudioProject"("tenantId", "updatedAt");
CREATE INDEX "FashionStudioProject_tenantId_sourcePostId_idx" ON "FashionStudioProject"("tenantId", "sourcePostId");
