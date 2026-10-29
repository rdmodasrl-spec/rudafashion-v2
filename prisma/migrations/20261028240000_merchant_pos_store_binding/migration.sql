-- 门店归属：POS 销售订单与员工门店绑定（全部为可空列，向后兼容）
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "MerchantEmployee" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

CREATE INDEX IF NOT EXISTS "Order_storeId_idx" ON "Order"("storeId");
CREATE INDEX IF NOT EXISTS "MerchantEmployee_merchantId_storeId_idx" ON "MerchantEmployee"("merchantId", "storeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_storeId_fkey'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "MerchantStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MerchantEmployee_storeId_fkey'
  ) THEN
    ALTER TABLE "MerchantEmployee" ADD CONSTRAINT "MerchantEmployee_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "MerchantStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
