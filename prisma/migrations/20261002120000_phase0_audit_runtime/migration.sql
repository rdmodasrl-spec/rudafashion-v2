ALTER TABLE "AuditLog"
ADD COLUMN "requestId" TEXT,
ADD COLUMN "merchantId" TEXT,
ADD COLUMN "targetType" TEXT,
ADD COLUMN "beforeState" TEXT,
ADD COLUMN "afterState" TEXT,
ADD COLUMN "result" TEXT DEFAULT 'success',
ADD COLUMN "errorCode" TEXT,
ADD COLUMN "metadata" TEXT;

CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");
CREATE INDEX "AuditLog_merchantId_timestamp_idx" ON "AuditLog"("merchantId", "timestamp");