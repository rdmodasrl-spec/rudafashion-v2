ALTER TABLE "Merchant" ADD COLUMN "storeSlug" TEXT;

UPDATE "Merchant"
SET "storeSlug" = CASE
  WHEN "code" IS NOT NULL AND "code" <> '' THEN lower(regexp_replace("code", '[^a-zA-Z0-9]+', '-', 'g'))
  ELSE lower(regexp_replace("id", '[^a-zA-Z0-9]+', '-', 'g'))
END
WHERE "storeSlug" IS NULL;

ALTER TABLE "Merchant" ALTER COLUMN "storeSlug" SET NOT NULL;
CREATE UNIQUE INDEX "Merchant_storeSlug_key" ON "Merchant"("storeSlug");
