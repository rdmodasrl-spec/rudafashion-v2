DO $$
DECLARE
  brain_table TEXT;
BEGIN
  FOREACH brain_table IN ARRAY ARRAY[
    'MerchantAiEmployeeMemory',
    'ModaGptBrainChunk',
    'ModaGptBrainDocument',
    'ModaGptBrainEntity',
    'ModaGptBrainEvaluation',
    'ModaGptBrainEvent',
    'ModaGptBrainExperience',
    'ModaGptBrainFact',
    'ModaGptBrainFeedback',
    'ModaGptBrainLearningRun',
    'ModaGptBrainLesson',
    'ModaGptBrainRetrievalLog'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN "industryId" VARCHAR(120) NOT NULL DEFAULT %L',
      brain_table,
      ''
    );
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN "studioId" VARCHAR(120) NOT NULL DEFAULT %L',
      brain_table,
      ''
    );
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN "knowledgeNamespace" VARCHAR(120) NOT NULL DEFAULT %L',
      brain_table,
      ''
    );
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (("industryId" = %L AND "studioId" = %L AND "knowledgeNamespace" = %L) OR ("industryId" <> %L AND "studioId" <> %L AND "knowledgeNamespace" <> %L))',
      brain_table,
      brain_table || '_namespace_complete',
      '',
      '',
      '',
      '',
      '',
      ''
    );
  END LOOP;
END $$;

DROP INDEX IF EXISTS "ModaGptBrainExperience_idempotencyKey_key";
CREATE UNIQUE INDEX "ModaGptBrainExperience_namespace_idempotency_key"
ON "ModaGptBrainExperience"("tenantId", "industryId", "studioId", "knowledgeNamespace", "idempotencyKey");

DROP INDEX IF EXISTS "ModaGptBrainEvaluation_idempotencyKey_key";
CREATE UNIQUE INDEX "ModaGptBrainEvaluation_namespace_idempotency_key"
ON "ModaGptBrainEvaluation"("tenantId", "industryId", "studioId", "knowledgeNamespace", "idempotencyKey");

DROP INDEX IF EXISTS "ModaGptBrainFeedback_tenantId_messageId_key";
CREATE UNIQUE INDEX "ModaGptBrainFeedback_namespace_message_key"
ON "ModaGptBrainFeedback"("tenantId", "industryId", "studioId", "knowledgeNamespace", "messageId");

DROP INDEX IF EXISTS "ModaGptBrainEntity_tenantId_merchantId_entityType_canonical_key";
CREATE UNIQUE INDEX "ModaGptBrainEntity_namespace_entity_key"
ON "ModaGptBrainEntity"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "entityType", "canonicalKey");

DROP INDEX IF EXISTS "ModaGptBrainLesson_tenantId_merchantId_sourceRef_key";
CREATE UNIQUE INDEX "ModaGptBrainLesson_namespace_source_key"
ON "ModaGptBrainLesson"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "sourceRef");

DROP INDEX IF EXISTS "ModaGptBrainEvent_tenantId_eventType_eventId_key";
CREATE UNIQUE INDEX "ModaGptBrainEvent_namespace_event_key"
ON "ModaGptBrainEvent"("tenantId", "industryId", "studioId", "knowledgeNamespace", "eventType", "eventId");

CREATE INDEX "MerchantAiEmployeeMemory_namespace_scope_status_idx"
ON "MerchantAiEmployeeMemory"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "scope", "status", "updatedAt");
CREATE INDEX "ModaGptBrainDocument_namespace_status_idx"
ON "ModaGptBrainDocument"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "status", "updatedAt");
CREATE INDEX "ModaGptBrainChunk_namespace_verification_idx"
ON "ModaGptBrainChunk"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "verificationStatus", "createdAt");
CREATE INDEX "ModaGptBrainEntity_namespace_status_idx"
ON "ModaGptBrainEntity"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "status");
CREATE INDEX "ModaGptBrainEvaluation_namespace_type_idx"
ON "ModaGptBrainEvaluation"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "evaluationType", "createdAt");
CREATE INDEX "ModaGptBrainEvent_namespace_status_idx"
ON "ModaGptBrainEvent"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "status", "occurredAt");
CREATE INDEX "ModaGptBrainFact_namespace_status_idx"
ON "ModaGptBrainFact"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "status", "predicate");
CREATE INDEX "ModaGptBrainFeedback_namespace_type_idx"
ON "ModaGptBrainFeedback"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "feedbackType", "createdAt");
CREATE INDEX "ModaGptBrainExperience_namespace_status_idx"
ON "ModaGptBrainExperience"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "status", "success", "createdAt");
CREATE INDEX "ModaGptBrainLearningRun_namespace_status_idx"
ON "ModaGptBrainLearningRun"("tenantId", "industryId", "studioId", "knowledgeNamespace", "status", "createdAt");
CREATE INDEX "ModaGptBrainLesson_namespace_status_idx"
ON "ModaGptBrainLesson"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "status", "lessonType", "updatedAt");
CREATE INDEX "ModaGptBrainRetrievalLog_namespace_createdAt_idx"
ON "ModaGptBrainRetrievalLog"("tenantId", "industryId", "studioId", "knowledgeNamespace", "merchantId", "createdAt");
