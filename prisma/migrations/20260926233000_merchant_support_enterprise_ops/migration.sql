ALTER TABLE "MerchantSupportConversation"
ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN "assignedAdminUsername" TEXT,
ADD COLUMN "responseCycleStartedAt" TIMESTAMP(3),
ADD COLUMN "firstResponseDueAt" TIMESTAMP(3),
ADD COLUMN "firstRespondedAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "resolvedByAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "aiHandoffReason" TEXT;

UPDATE "MerchantSupportConversation"
SET "firstResponseDueAt" = "createdAt" + INTERVAL '24 hours'
WHERE "firstResponseDueAt" IS NULL;

UPDATE "MerchantSupportConversation"
SET "responseCycleStartedAt" = "createdAt"
WHERE "responseCycleStartedAt" IS NULL;

UPDATE "MerchantSupportConversation"
SET "resolvedAt" = "updatedAt"
WHERE "status" = 'resolved' AND "resolvedAt" IS NULL;

CREATE INDEX "MerchantSupportConversation_assignedAdminUsername_status_idx"
ON "MerchantSupportConversation"("assignedAdminUsername", "status");
CREATE INDEX "MerchantSupportConversation_priority_status_idx"
ON "MerchantSupportConversation"("priority", "status");
CREATE INDEX "MerchantSupportConversation_firstResponseDueAt_status_idx"
ON "MerchantSupportConversation"("firstResponseDueAt", "status");
