ALTER TABLE "MerchantPayout"
  ADD COLUMN "settlementReference" TEXT,
  ADD COLUMN "settlementProof" TEXT,
  ADD COLUMN "settledAt" TIMESTAMP(3),
  ADD COLUMN "settledBy" TEXT;

ALTER TABLE "SupportRequest"
  ADD COLUMN "internalNote" TEXT,
  ADD COLUMN "internalNoteUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "internalNoteUpdatedBy" TEXT,
  ADD COLUMN "customerReply" TEXT,
  ADD COLUMN "replyDeliveryStatus" TEXT NOT NULL DEFAULT 'not_sent',
  ADD COLUMN "replyAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "replyAttemptedBy" TEXT,
  ADD COLUMN "replyProviderAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "replyProviderAcceptedBy" TEXT,
  ADD COLUMN "replyDeliveryError" TEXT;

UPDATE "SupportRequest"
SET "internalNote" = "adminReply"
WHERE "adminReply" IS NOT NULL;
