UPDATE "MerchantEmployee"
SET "permissions" = CASE "role"
  WHEN 'sales' THEN '["sales.order.create","pricing.request"]'
  WHEN 'warehouse' THEN '["warehouse.pick","warehouse.review","warehouse.pack","warehouse.ship"]'
  WHEN 'production' THEN '["production.report"]'
  WHEN 'store_manager' THEN '["sales.order.create","pricing.request","pricing.approve","warehouse.pick","warehouse.review","warehouse.pack","warehouse.ship","production.report","employees.manage"]'
  ELSE '[]'
END
WHERE "permissions" IS NULL OR TRIM("permissions") = '' OR "permissions" = '[]';
