CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN (lower("name") gin_trgm_ops);
CREATE INDEX "Product_name_zh_trgm_idx" ON "Product" USING GIN (lower("name_zh") gin_trgm_ops);
CREATE INDEX "Product_name_it_trgm_idx" ON "Product" USING GIN (lower("name_it") gin_trgm_ops);
