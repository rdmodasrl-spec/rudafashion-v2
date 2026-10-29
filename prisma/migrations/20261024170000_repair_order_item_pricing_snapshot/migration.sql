ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "pricingSnapshot" TEXT;
