CREATE TABLE "ModaGptTask" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "taskType" VARCHAR(80) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "payload" TEXT NOT NULL,
    "result" TEXT,
    "idempotencyKey" VARCHAR(160),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" VARCHAR(120),
    "lockedUntil" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(80),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModaGptTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModaGptTask_idempotencyKey_key" ON "ModaGptTask"("idempotencyKey");
CREATE INDEX "ModaGptTask_status_availableAt_createdAt_idx" ON "ModaGptTask"("status", "availableAt", "createdAt");
CREATE INDEX "ModaGptTask_status_lockedUntil_idx" ON "ModaGptTask"("status", "lockedUntil");
CREATE INDEX "ModaGptTask_merchantId_createdAt_idx" ON "ModaGptTask"("merchantId", "createdAt");
CREATE INDEX "ModaGptTask_taskType_status_createdAt_idx" ON "ModaGptTask"("taskType", "status", "createdAt");
