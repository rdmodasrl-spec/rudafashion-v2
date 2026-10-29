CREATE TABLE "RiskAlert" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metricName" TEXT,
    "metricValue" DECIMAL(16,4),
    "threshold" DECIMAL(16,4),
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskAlert_severity_isAcknowledged_idx"
ON "RiskAlert"("severity", "isAcknowledged");

CREATE INDEX "RiskAlert_type_createdAt_idx"
ON "RiskAlert"("type", "createdAt");
