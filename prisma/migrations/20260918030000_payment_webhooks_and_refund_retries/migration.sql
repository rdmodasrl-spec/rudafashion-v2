ALTER TABLE "RefundTransaction" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefundTransaction" ADD COLUMN "nextRetryAt" TIMESTAMP(3);
ALTER TABLE "RefundTransaction" ADD COLUMN "lastError" TEXT;

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider", "providerEventId");
CREATE INDEX "PaymentWebhookEvent_processedAt_idx" ON "PaymentWebhookEvent"("processedAt");
