-- Repair installations where the idempotency migration was marked applied
-- before the column was created.
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "StockTransfer_idempotencyKey_key" ON "StockTransfer"("idempotencyKey");
