-- 商家通知中心：业务处理状态（待处理 / 已处理）与投递状态解耦。
-- 仅新增列与索引，默认 open；回滚可删索引与列（历史处理状态丢失，不影响通知投递）。
ALTER TABLE "NotificationEvent" ADD COLUMN IF NOT EXISTS "businessStatus" VARCHAR(24) NOT NULL DEFAULT 'open';

CREATE INDEX IF NOT EXISTS "NotificationEvent_recipient_businessStatus_idx"
ON "NotificationEvent"("recipient", "businessStatus");
