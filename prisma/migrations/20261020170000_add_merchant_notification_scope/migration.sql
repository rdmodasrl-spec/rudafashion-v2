ALTER TABLE "NotificationEvent"
ADD COLUMN "merchantId" TEXT,
ADD COLUMN "recipientUserId" TEXT,
ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN "relatedEntityType" TEXT,
ADD COLUMN "relatedEntityId" TEXT,
ADD COLUMN "businessStatus" TEXT NOT NULL DEFAULT 'open';

CREATE INDEX "NotificationEvent_merchantId_channel_createdAt_idx"
ON "NotificationEvent"("merchantId", "channel", "createdAt");

CREATE INDEX "NotificationEvent_recipientUserId_channel_createdAt_idx"
ON "NotificationEvent"("recipientUserId", "channel", "createdAt");
