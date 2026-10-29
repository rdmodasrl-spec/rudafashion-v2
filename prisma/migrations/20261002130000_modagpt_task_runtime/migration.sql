ALTER TABLE "ModaGptTask"
ADD COLUMN "tenantId" TEXT,
ADD COLUMN "actorId" VARCHAR(160),
ADD COLUMN "traceId" VARCHAR(160),
ADD COLUMN "parentTaskId" VARCHAR(160),
ADD COLUMN "goal" TEXT,
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "agentId" VARCHAR(80),
ADD COLUMN "context" TEXT,
ADD COLUMN "plan" TEXT,
ADD COLUMN "error" TEXT,
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "ModaGptTask"
SET "tenantId" = "merchantId",
    "traceId" = "id",
    "goal" = "taskType",
    "context" = "payload",
    "retryCount" = GREATEST("attempts" - 1, 0),
    "status" = CASE "status"
      WHEN 'pending' THEN 'queued'
      WHEN 'processing' THEN 'running'
      WHEN 'retry' THEN 'retrying'
      WHEN 'succeeded' THEN 'completed'
      ELSE "status"
    END;

UPDATE "ModaGptTask"
SET "error" = jsonb_build_object('code', "lastErrorCode")::text
WHERE "lastErrorCode" IS NOT NULL;

ALTER TABLE "ModaGptTask"
ALTER COLUMN "traceId" SET NOT NULL,
ALTER COLUMN "goal" SET NOT NULL,
ALTER COLUMN "context" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'queued';

DROP INDEX IF EXISTS "ModaGptTask_status_availableAt_createdAt_idx";
CREATE INDEX "ModaGptTask_status_priority_availableAt_createdAt_idx"
ON "ModaGptTask"("status", "priority" DESC, "availableAt", "createdAt");
CREATE INDEX "ModaGptTask_tenantId_status_createdAt_idx"
ON "ModaGptTask"("tenantId", "status", "createdAt");
CREATE INDEX "ModaGptTask_traceId_idx" ON "ModaGptTask"("traceId");
CREATE INDEX "ModaGptTask_parentTaskId_idx" ON "ModaGptTask"("parentTaskId");
