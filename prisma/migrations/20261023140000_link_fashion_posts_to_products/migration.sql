-- Baseline reconstruction of a migration applied to production on 2026-10-23 but
-- never committed. This added the legacy single-product column. Multi-product
-- linking now lives in "FashionCommunityPostProduct" (see
-- 20261028180000_fashion_community_stage2); the legacy column is kept for
-- backwards compatibility and is not used by the current API.
ALTER TABLE "FashionCommunityPost"
  ADD COLUMN IF NOT EXISTS "productId" TEXT;

CREATE INDEX IF NOT EXISTS "FashionCommunityPost_productId_idx"
  ON "FashionCommunityPost"("productId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FashionCommunityPost_productId_fkey') THEN
    ALTER TABLE "FashionCommunityPost"
      ADD CONSTRAINT "FashionCommunityPost_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
