DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Merchant") > 999999 THEN
    RAISE EXCEPTION 'Merchant store lookup codes support at most 999999 merchants';
  END IF;
END $$;

CREATE SEQUENCE "merchant_store_lookup_code_seq"
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 999999
  NO CYCLE;

ALTER TABLE "Merchant"
ADD COLUMN "storeLookupCode" TEXT;

WITH numbered_merchants AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS ordinal
  FROM "Merchant"
)
UPDATE "Merchant" AS merchant
SET "storeLookupCode" = LPAD(numbered_merchants.ordinal::TEXT, 6, '0')
FROM numbered_merchants
WHERE merchant."id" = numbered_merchants."id";

SELECT setval(
  '"merchant_store_lookup_code_seq"',
  GREATEST((SELECT COUNT(*) FROM "Merchant"), 1),
  (SELECT COUNT(*) > 0 FROM "Merchant")
);

ALTER TABLE "Merchant"
ALTER COLUMN "storeLookupCode" SET DEFAULT (
  LPAD(nextval('"merchant_store_lookup_code_seq"')::TEXT, 6, '0')
);

ALTER TABLE "Merchant"
ALTER COLUMN "storeLookupCode" SET NOT NULL;

CREATE UNIQUE INDEX "Merchant_storeLookupCode_key"
ON "Merchant"("storeLookupCode");
