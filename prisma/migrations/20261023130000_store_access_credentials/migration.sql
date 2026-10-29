-- Baseline reconstruction of a migration that was applied to production on
-- 2026-10-23 but whose file was never committed. Written idempotently so it is
-- safe for existing databases and still creates the structure on new ones.
CREATE TABLE IF NOT EXISTS "StoreAccessCredential" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "label" VARCHAR(80),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "StoreAccessCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreAccessCredential_codeHash_key"
  ON "StoreAccessCredential"("codeHash");
CREATE INDEX IF NOT EXISTS "StoreAccessCredential_merchantId_revokedAt_expiresAt_idx"
  ON "StoreAccessCredential"("merchantId", "revokedAt", "expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoreAccessCredential_merchantId_fkey') THEN
    ALTER TABLE "StoreAccessCredential"
      ADD CONSTRAINT "StoreAccessCredential_merchantId_fkey"
      FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
