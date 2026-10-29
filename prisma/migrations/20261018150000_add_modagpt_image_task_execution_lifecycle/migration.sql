ALTER TABLE "ModaGptTask"
ADD COLUMN "requestPayloadHash" VARCHAR(64),
ADD COLUMN "provider" VARCHAR(32),
ADD COLUMN "model" VARCHAR(160),
ADD COLUMN "providerRequestId" VARCHAR(180),
ADD COLUMN "providerCostMinor" INTEGER,
ADD COLUMN "executionPhase" VARCHAR(40),
ADD COLUMN "resultStorageKey" VARCHAR(512),
ADD COLUMN "resultStorageBucket" VARCHAR(160),
ADD COLUMN "resultExpiresAt" TIMESTAMP(3),
ADD COLUMN "cleanupAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cleanupNextAttemptAt" TIMESTAMP(3),
ADD COLUMN "cleanupLastError" VARCHAR(80),
ADD COLUMN "billingMode" VARCHAR(16),
ADD COLUMN "billingStatus" VARCHAR(16),
ADD COLUMN "billingUsageKey" VARCHAR(180),
ADD COLUMN "billingPlanId" VARCHAR(32),
ADD COLUMN "billingSubscriptionId" TEXT,
ADD COLUMN "billingFeature" VARCHAR(64),
ADD COLUMN "billingCredits" INTEGER,
ADD COLUMN "legacyQuotaFeature" VARCHAR(32),
ADD COLUMN "legacyQuotaPeriod" VARCHAR(32),
ADD COLUMN "legacyQuotaPlan" VARCHAR(16),
ADD COLUMN "creditReservationId" TEXT;

CREATE INDEX "ModaGptTask_provider_providerRequestId_idx"
ON "ModaGptTask"("provider", "providerRequestId");

CREATE INDEX "ModaGptTask_taskType_resultExpiresAt_cleanupNextAttemptAt_idx"
ON "ModaGptTask"("taskType", "resultExpiresAt", "cleanupNextAttemptAt");

CREATE UNIQUE INDEX "ModaGptTask_creditReservationId_key"
ON "ModaGptTask"("creditReservationId");

ALTER TABLE "ModaGptTask"
ADD CONSTRAINT "ModaGptTask_creditReservationId_fkey"
FOREIGN KEY ("creditReservationId") REFERENCES "ModaGptCreditReservation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
