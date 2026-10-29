ALTER TABLE "NotificationEvent" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "NotificationEvent_recipient_channel_status_idx"
ON "NotificationEvent"("recipient", "channel", "status");
