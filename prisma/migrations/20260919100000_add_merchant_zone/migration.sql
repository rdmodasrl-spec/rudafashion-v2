ALTER TABLE "Merchant" ADD COLUMN IF NOT EXISTS "merchantZone" TEXT NOT NULL DEFAULT 'iolo';
CREATE INDEX IF NOT EXISTS "Merchant_merchantZone_idx" ON "Merchant"("merchantZone");