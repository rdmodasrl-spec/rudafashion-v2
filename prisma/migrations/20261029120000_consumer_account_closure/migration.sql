-- 消费者账户闭环：收藏关系 + 订单归属。
-- 仅新增结构，无数据回填；回滚可删除表、列与索引（不影响既有 B2B 数据）。

CREATE TABLE IF NOT EXISTS "ConsumerWishlistItem" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerWishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConsumerWishlistItem_consumerId_productId_key"
ON "ConsumerWishlistItem"("consumerId", "productId");

CREATE INDEX IF NOT EXISTS "ConsumerWishlistItem_consumerId_createdAt_idx"
ON "ConsumerWishlistItem"("consumerId", "createdAt");

CREATE INDEX IF NOT EXISTS "ConsumerWishlistItem_productId_idx"
ON "ConsumerWishlistItem"("productId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConsumerWishlistItem_consumerId_fkey') THEN
        ALTER TABLE "ConsumerWishlistItem"
            ADD CONSTRAINT "ConsumerWishlistItem_consumerId_fkey"
            FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConsumerWishlistItem_productId_fkey') THEN
        ALTER TABLE "ConsumerWishlistItem"
            ADD CONSTRAINT "ConsumerWishlistItem_productId_fkey"
            FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "consumerId" TEXT;

CREATE INDEX IF NOT EXISTS "Order_consumerId_idx" ON "Order"("consumerId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_consumerId_fkey') THEN
        ALTER TABLE "Order"
            ADD CONSTRAINT "Order_consumerId_fkey"
            FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
