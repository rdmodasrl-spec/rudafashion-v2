ALTER TABLE "StockTransfer" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "StockTransfer_idempotencyKey_key" ON "StockTransfer"("idempotencyKey");
