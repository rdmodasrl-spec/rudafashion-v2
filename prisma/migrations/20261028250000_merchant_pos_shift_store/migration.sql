-- 多门店 POS 班次归属：班次绑定门店，收银台按 (商家, 门店, 收银台) 唯一。
-- 变更可逆：删除索引与列即可回滚（门店归属信息丢失，但历史班次仍保留金额数据）。
ALTER TABLE "MerchantPosShift" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

DROP INDEX IF EXISTS "MerchantPosShift_one_open_register_idx";

CREATE UNIQUE INDEX "MerchantPosShift_one_open_register_idx"
ON "MerchantPosShift"("merchantId", COALESCE("storeId", ''), "registerCode")
WHERE "status" = 'open';

CREATE INDEX IF NOT EXISTS "MerchantPosShift_merchantId_storeId_status_idx"
ON "MerchantPosShift"("merchantId", "storeId", "status");
