CREATE TABLE "ModaGptAdminOperatorConfig" (
  "id" VARCHAR(32) NOT NULL,
  "instructions" TEXT NOT NULL,
  "updatedBy" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModaGptAdminOperatorConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModaGptAdminOperatorDraft" (
  "id" VARCHAR(80) NOT NULL,
  "kind" VARCHAR(24) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
  "payload" TEXT NOT NULL,
  "result" TEXT,
  "createdBy" VARCHAR(120) NOT NULL,
  "committedBy" VARCHAR(120),
  "committedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModaGptAdminOperatorDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModaGptAdminOperatorDraft_status_createdAt_idx"
  ON "ModaGptAdminOperatorDraft"("status", "createdAt");
CREATE INDEX "ModaGptAdminOperatorDraft_kind_createdAt_idx"
  ON "ModaGptAdminOperatorDraft"("kind", "createdAt");
CREATE INDEX "ModaGptAdminOperatorDraft_createdBy_createdAt_idx"
  ON "ModaGptAdminOperatorDraft"("createdBy", "createdAt");
