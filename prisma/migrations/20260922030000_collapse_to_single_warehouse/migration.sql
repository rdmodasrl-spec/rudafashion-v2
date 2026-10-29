-- RUDA now operates one physical warehouse only.
-- Historical non-central balances and movements are intentionally removed per
-- the single-warehouse rollout decision.
DELETE FROM "StockTransfer"
WHERE LOWER("fromLocation") <> 'central'
   OR LOWER("toLocation") <> 'central';

UPDATE "Product"
SET "skus" = (
  SELECT COALESCE(jsonb_agg(
    jsonb_set(
      jsonb_set(
        jsonb_set(value, '{stockMestre}', '0'::jsonb),
        '{stockMilano}', '0'::jsonb
      ),
      '{reserved}', '0'::jsonb
    )
  ), '[]'::jsonb)::text
  FROM jsonb_array_elements("Product"."skus"::jsonb)
);

DELETE FROM "WarehouseLocation"
WHERE "merchantId" IS NULL
  AND "code" <> 'central';
