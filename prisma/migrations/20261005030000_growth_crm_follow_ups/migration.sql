CREATE TABLE "GrowthCrmFollowUp" (
  "id" TEXT NOT NULL,
  "consumerId" TEXT,
  "customerId" TEXT,
  "category" VARCHAR(24) NOT NULL,
  "note" VARCHAR(1000) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'open',
  "createdBy" VARCHAR(160) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthCrmFollowUp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrowthCrmFollowUp_exactly_one_subject_check" CHECK (
    ("consumerId" IS NOT NULL AND "customerId" IS NULL)
    OR ("consumerId" IS NULL AND "customerId" IS NOT NULL)
  ),
  CONSTRAINT "GrowthCrmFollowUp_category_check" CHECK (
    "category" IN ('sales', 'activation', 'retention', 'service')
  ),
  CONSTRAINT "GrowthCrmFollowUp_status_check" CHECK (
    "status" IN ('open', 'completed', 'cancelled')
  ),
  CONSTRAINT "GrowthCrmFollowUp_completion_check" CHECK (
    ("status" = 'completed' AND "completedAt" IS NOT NULL)
    OR ("status" <> 'completed' AND "completedAt" IS NULL)
  ),
  CONSTRAINT "GrowthCrmFollowUp_consumerId_fkey"
    FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GrowthCrmFollowUp_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GrowthCrmFollowUp_status_dueAt_idx" ON "GrowthCrmFollowUp"("status", "dueAt");
CREATE INDEX "GrowthCrmFollowUp_consumerId_createdAt_idx" ON "GrowthCrmFollowUp"("consumerId", "createdAt");
CREATE INDEX "GrowthCrmFollowUp_customerId_createdAt_idx" ON "GrowthCrmFollowUp"("customerId", "createdAt");
