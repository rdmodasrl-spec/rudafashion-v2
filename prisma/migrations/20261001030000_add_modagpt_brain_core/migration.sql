ALTER TABLE "MerchantAiEmployeeMemory"
ADD COLUMN "tenantId" TEXT,
ADD COLUMN "scope" VARCHAR(24) NOT NULL DEFAULT 'MERCHANT',
ADD COLUMN "memoryType" VARCHAR(32) NOT NULL DEFAULT 'preference',
ADD COLUMN "status" VARCHAR(24) NOT NULL DEFAULT 'active',
ADD COLUMN "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN "source" VARCHAR(24) NOT NULL DEFAULT 'USER',
ADD COLUMN "sourceRef" VARCHAR(160),
ADD COLUMN "verificationStatus" VARCHAR(24) NOT NULL DEFAULT 'unverified',
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "validFrom" TIMESTAMP(3),
ADD COLUMN "validUntil" TIMESTAMP(3),
ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN "lastAccessedAt" TIMESTAMP(3),
ADD COLUMN "accessCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "MerchantAiEmployeeMemory" SET "tenantId" = "merchantId";
ALTER TABLE "MerchantAiEmployeeMemory" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "MerchantAiEmployeeMemory_tenantId_merchantId_scope_status_u_idx"
ON "MerchantAiEmployeeMemory"("tenantId", "merchantId", "scope", "status", "updatedAt");

CREATE TABLE "ModaGptBrainDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "sourceType" VARCHAR(32) NOT NULL,
    "sourceId" VARCHAR(160),
    "sourceUrl" TEXT,
    "title" VARCHAR(240) NOT NULL,
    "mimeType" VARCHAR(120),
    "authorization" TEXT NOT NULL DEFAULT '{}',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "status" VARCHAR(24) NOT NULL DEFAULT 'ingested',
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceTrust" VARCHAR(24) NOT NULL DEFAULT 'unverified',
    "createdBy" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModaGptBrainDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModaGptBrainDocument_tenantId_merchantId_status_updatedAt_idx"
ON "ModaGptBrainDocument"("tenantId", "merchantId", "status", "updatedAt");
CREATE INDEX "ModaGptBrainDocument_tenantId_sourceType_sourceId_version_idx"
ON "ModaGptBrainDocument"("tenantId", "sourceType", "sourceId", "version");

CREATE TABLE "ModaGptBrainChunk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "keywordText" TEXT NOT NULL,
    "embedding" TEXT,
    "embeddingModel" VARCHAR(120),
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "authorization" TEXT NOT NULL DEFAULT '{}',
    "source" VARCHAR(24) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "verificationStatus" VARCHAR(24) NOT NULL DEFAULT 'unverified',
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModaGptBrainChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ModaGptBrainChunk_documentId_fkey" FOREIGN KEY ("documentId")
      REFERENCES "ModaGptBrainDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ModaGptBrainChunk_documentId_chunkIndex_key" ON "ModaGptBrainChunk"("documentId", "chunkIndex");
CREATE INDEX "ModaGptBrainChunk_tenantId_merchantId_verificationStatus_cr_idx"
ON "ModaGptBrainChunk"("tenantId", "merchantId", "verificationStatus", "createdAt");
CREATE INDEX "ModaGptBrainChunk_tenantId_documentId_idx" ON "ModaGptBrainChunk"("tenantId", "documentId");

CREATE TABLE "ModaGptBrainExperience" (
    "id" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(160),
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "taskId" VARCHAR(160),
    "agentSlug" VARCHAR(80) NOT NULL,
    "goal" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '{}',
    "actions" TEXT NOT NULL DEFAULT '[]',
    "toolsUsed" TEXT NOT NULL DEFAULT '[]',
    "modelUsed" VARCHAR(120),
    "result" TEXT NOT NULL,
    "verification" TEXT NOT NULL DEFAULT '{}',
    "businessOutcome" TEXT,
    "success" BOOLEAN,
    "status" VARCHAR(24) NOT NULL DEFAULT 'candidate',
    "source" VARCHAR(24) NOT NULL DEFAULT 'AGENT',
    "sourceRef" VARCHAR(160),
    "agentVersion" VARCHAR(32),
    "promptVersion" VARCHAR(32),
    "modelVersion" VARCHAR(120),
    "toolVersion" VARCHAR(32),
    "workflowVersion" VARCHAR(32),
    "latencyMs" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModaGptBrainExperience_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModaGptBrainExperience_idempotencyKey_key" ON "ModaGptBrainExperience"("idempotencyKey");
CREATE INDEX "ModaGptBrainExperience_tenantId_merchantId_agentSlug_create_idx"
ON "ModaGptBrainExperience"("tenantId", "merchantId", "agentSlug", "createdAt");
CREATE INDEX "ModaGptBrainExperience_tenantId_status_success_createdAt_idx"
ON "ModaGptBrainExperience"("tenantId", "status", "success", "createdAt");
CREATE INDEX "ModaGptBrainExperience_taskId_idx" ON "ModaGptBrainExperience"("taskId");

CREATE TABLE "ModaGptBrainEvaluation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(160),
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "experienceId" TEXT NOT NULL,
    "evaluationType" VARCHAR(32) NOT NULL,
    "quality" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "relevance" DOUBLE PRECISION,
    "toolSuccess" BOOLEAN,
    "verificationResult" VARCHAR(24) NOT NULL DEFAULT 'unknown',
    "userFeedback" VARCHAR(24),
    "businessOutcome" VARCHAR(24),
    "latencyMs" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "evaluator" VARCHAR(24) NOT NULL DEFAULT 'SYSTEM',
    "datasetVersion" VARCHAR(32),
    "promptVersion" VARCHAR(32),
    "modelVersion" VARCHAR(120),
    "details" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModaGptBrainEvaluation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ModaGptBrainEvaluation_experienceId_fkey" FOREIGN KEY ("experienceId")
      REFERENCES "ModaGptBrainExperience"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ModaGptBrainEvaluation_idempotencyKey_key" ON "ModaGptBrainEvaluation"("idempotencyKey");
CREATE INDEX "ModaGptBrainEvaluation_tenantId_merchantId_evaluationType_c_idx"
ON "ModaGptBrainEvaluation"("tenantId", "merchantId", "evaluationType", "createdAt");
CREATE INDEX "ModaGptBrainEvaluation_tenantId_experienceId_createdAt_idx"
ON "ModaGptBrainEvaluation"("tenantId", "experienceId", "createdAt");

CREATE TABLE "ModaGptBrainFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "experienceId" TEXT,
    "messageId" VARCHAR(160),
    "actorId" VARCHAR(160),
    "feedbackType" VARCHAR(24) NOT NULL,
    "original" TEXT,
    "edited" TEXT,
    "outcome" TEXT,
    "source" VARCHAR(24) NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModaGptBrainFeedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ModaGptBrainFeedback_experienceId_fkey" FOREIGN KEY ("experienceId")
      REFERENCES "ModaGptBrainExperience"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ModaGptBrainFeedback_tenantId_merchantId_feedbackType_creat_idx"
ON "ModaGptBrainFeedback"("tenantId", "merchantId", "feedbackType", "createdAt");
CREATE INDEX "ModaGptBrainFeedback_tenantId_experienceId_createdAt_idx"
ON "ModaGptBrainFeedback"("tenantId", "experienceId", "createdAt");
CREATE INDEX "ModaGptBrainFeedback_messageId_idx" ON "ModaGptBrainFeedback"("messageId");
CREATE UNIQUE INDEX "ModaGptBrainFeedback_tenantId_messageId_key"
ON "ModaGptBrainFeedback"("tenantId", "messageId");

CREATE TABLE "ModaGptBrainEntity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "entityType" VARCHAR(40) NOT NULL,
    "canonicalKey" VARCHAR(200) NOT NULL,
    "displayName" VARCHAR(240) NOT NULL,
    "source" VARCHAR(24) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" VARCHAR(24) NOT NULL DEFAULT 'candidate',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModaGptBrainEntity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModaGptBrainEntity_tenantId_merchantId_entityType_canonical_key"
ON "ModaGptBrainEntity"("tenantId", "merchantId", "entityType", "canonicalKey");
CREATE INDEX "ModaGptBrainEntity_tenantId_merchantId_entityType_status_idx"
ON "ModaGptBrainEntity"("tenantId", "merchantId", "entityType", "status");

CREATE TABLE "ModaGptBrainFact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "subjectEntityId" TEXT,
    "predicate" VARCHAR(80) NOT NULL,
    "objectEntityId" TEXT,
    "value" TEXT,
    "source" VARCHAR(24) NOT NULL,
    "sourceRef" VARCHAR(160),
    "sourceTrust" VARCHAR(24) NOT NULL DEFAULT 'unverified',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "verificationStatus" VARCHAR(24) NOT NULL DEFAULT 'candidate',
    "status" VARCHAR(24) NOT NULL DEFAULT 'candidate',
    "contradictionGroupId" VARCHAR(160),
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModaGptBrainFact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ModaGptBrainFact_subjectEntityId_fkey" FOREIGN KEY ("subjectEntityId")
      REFERENCES "ModaGptBrainEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ModaGptBrainFact_objectEntityId_fkey" FOREIGN KEY ("objectEntityId")
      REFERENCES "ModaGptBrainEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ModaGptBrainFact_tenantId_merchantId_status_predicate_idx"
ON "ModaGptBrainFact"("tenantId", "merchantId", "status", "predicate");
CREATE INDEX "ModaGptBrainFact_tenantId_subjectEntityId_predicate_created_idx"
ON "ModaGptBrainFact"("tenantId", "subjectEntityId", "predicate", "createdAt");
CREATE INDEX "ModaGptBrainFact_tenantId_contradictionGroupId_idx"
ON "ModaGptBrainFact"("tenantId", "contradictionGroupId");

CREATE TABLE "ModaGptBrainLesson" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "lessonType" VARCHAR(40) NOT NULL,
    "pattern" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION,
    "status" VARCHAR(24) NOT NULL DEFAULT 'candidate',
    "riskLevel" VARCHAR(16) NOT NULL DEFAULT 'low',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(24) NOT NULL DEFAULT 'AGENT',
    "sourceRef" VARCHAR(160),
    "contradictionCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModaGptBrainLesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModaGptBrainLesson_tenantId_merchantId_status_lessonType_up_idx"
ON "ModaGptBrainLesson"("tenantId", "merchantId", "status", "lessonType", "updatedAt");
CREATE UNIQUE INDEX "ModaGptBrainLesson_tenantId_merchantId_sourceRef_key"
ON "ModaGptBrainLesson"("tenantId", "merchantId", "sourceRef");

CREATE TABLE "ModaGptBrainLessonEvidence" (
    "lessonId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "outcome" VARCHAR(24) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModaGptBrainLessonEvidence_pkey" PRIMARY KEY ("lessonId", "experienceId"),
    CONSTRAINT "ModaGptBrainLessonEvidence_lessonId_fkey" FOREIGN KEY ("lessonId")
      REFERENCES "ModaGptBrainLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModaGptBrainLessonEvidence_experienceId_fkey" FOREIGN KEY ("experienceId")
      REFERENCES "ModaGptBrainExperience"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ModaGptBrainLessonEvidence_experienceId_idx" ON "ModaGptBrainLessonEvidence"("experienceId");

CREATE TABLE "ModaGptBrainEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "eventType" VARCHAR(80) NOT NULL,
    "eventId" VARCHAR(160) NOT NULL,
    "payload" TEXT NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'received',
    "source" VARCHAR(24) NOT NULL DEFAULT 'BUSINESS_EVENT',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "failureCode" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModaGptBrainEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModaGptBrainEvent_tenantId_eventType_eventId_key"
ON "ModaGptBrainEvent"("tenantId", "eventType", "eventId");
CREATE INDEX "ModaGptBrainEvent_tenantId_merchantId_status_occurredAt_idx"
ON "ModaGptBrainEvent"("tenantId", "merchantId", "status", "occurredAt");

CREATE TABLE "ModaGptBrainRetrievalLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT,
    "actorId" TEXT,
    "queryHash" VARCHAR(64) NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "resultRefs" TEXT NOT NULL DEFAULT '[]',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "retrievalVersion" VARCHAR(32) NOT NULL DEFAULT '1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModaGptBrainRetrievalLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModaGptBrainRetrievalLog_tenantId_merchantId_createdAt_idx"
ON "ModaGptBrainRetrievalLog"("tenantId", "merchantId", "createdAt");

CREATE TABLE "ModaGptBrainLearningRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "runType" VARCHAR(40) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "inputCount" INTEGER NOT NULL DEFAULT 0,
    "promotedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "failureCode" VARCHAR(80),
    "policyVersion" VARCHAR(32) NOT NULL DEFAULT '1',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModaGptBrainLearningRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModaGptBrainLearningRun_tenantId_status_createdAt_idx"
ON "ModaGptBrainLearningRun"("tenantId", "status", "createdAt");
