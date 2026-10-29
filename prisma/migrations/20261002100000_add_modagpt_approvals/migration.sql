CREATE TABLE "ModaGptApproval" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "taskId" VARCHAR(160) NOT NULL,
    "toolId" VARCHAR(80) NOT NULL,
    "resourceId" VARCHAR(160) NOT NULL,
    "payload" TEXT NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "requestedBy" VARCHAR(160) NOT NULL,
    "decidedBy" VARCHAR(160),
    "decisionNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModaGptApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModaGptApproval_merchantId_taskId_toolId_key"
ON "ModaGptApproval"("merchantId", "taskId", "toolId");

CREATE INDEX "ModaGptApproval_merchantId_status_createdAt_idx"
ON "ModaGptApproval"("merchantId", "status", "createdAt");

CREATE INDEX "ModaGptApproval_merchantId_resourceId_status_idx"
ON "ModaGptApproval"("merchantId", "resourceId", "status");

ALTER TABLE "ModaGptApproval"
ADD CONSTRAINT "ModaGptApproval_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
