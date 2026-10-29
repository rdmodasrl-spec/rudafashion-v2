UPDATE "AiEmployeeDefinition"
SET
    "description" = '可在商家明确授权后只读检索本店商品目录；商品编辑、发布和改价尚未开放。',
    "capabilities" = '["本店商品目录只读检索"]',
    "requiredPermissions" = '["product.catalog.read"]',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'product-manager';
