ALTER TABLE "MerchantAssistantMessage"
ADD COLUMN "feedback" TEXT,
ADD COLUMN "feedbackAt" TIMESTAMP(3),
ADD COLUMN "feedbackPrompt" TEXT;

CREATE INDEX "MerchantAssistantMessage_feedback_createdAt_idx"
ON "MerchantAssistantMessage"("feedback", "createdAt");
