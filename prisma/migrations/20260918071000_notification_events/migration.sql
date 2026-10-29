CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationEvent_idempotencyKey_key" ON "NotificationEvent"("idempotencyKey");
CREATE INDEX "NotificationEvent_status_nextAttemptAt_idx" ON "NotificationEvent"("status", "nextAttemptAt");
CREATE INDEX "NotificationEvent_recipient_idx" ON "NotificationEvent"("recipient");
CREATE INDEX "NotificationEvent_eventType_idx" ON "NotificationEvent"("eventType");
