CREATE TABLE "GrowthMission" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "objective" TEXT NOT NULL,
  "audience" VARCHAR(500) NOT NULL,
  "markets" TEXT NOT NULL,
  "channels" TEXT NOT NULL,
  "budgetAmount" DECIMAL(14, 2) NOT NULL,
  "budgetCurrency" VARCHAR(3) NOT NULL,
  "conversionGoal" VARCHAR(200) NOT NULL,
  "landingPath" VARCHAR(500) NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "plan" TEXT NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'plan_ready',
  "idempotencyKey" VARCHAR(160),
  "createdBy" VARCHAR(160) NOT NULL,
  "approvedBy" VARCHAR(160),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthMission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrowthMission_budgetAmount_check" CHECK ("budgetAmount" >= 0),
  CONSTRAINT "GrowthMission_endAt_check" CHECK ("endAt" > "startAt"),
  CONSTRAINT "GrowthMission_status_check" CHECK ("status" IN ('plan_ready', 'plan_approved', 'paused', 'cancelled'))
);

CREATE UNIQUE INDEX "GrowthMission_idempotencyKey_key" ON "GrowthMission"("idempotencyKey");
CREATE INDEX "GrowthMission_status_createdAt_idx" ON "GrowthMission"("status", "createdAt");
CREATE INDEX "GrowthMission_createdBy_createdAt_idx" ON "GrowthMission"("createdBy", "createdAt");
