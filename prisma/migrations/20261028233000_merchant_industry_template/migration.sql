-- 商家经营类型模板：把现有服装后台正式绑定到 apparel_production_wholesale。
-- 幂等性：使用 IF NOT EXISTS，可重复执行；不改动既有列语义。
ALTER TABLE "Merchant"
  ADD COLUMN IF NOT EXISTS "industryTemplate" VARCHAR(48),
  ADD COLUMN IF NOT EXISTS "industryTemplateSource" VARCHAR(32) NOT NULL DEFAULT 'LEGACY_PENDING_REVIEW',
  ADD COLUMN IF NOT EXISTS "industryTemplateInitializedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registrationProfile" JSONB;

CREATE INDEX IF NOT EXISTS "Merchant_industryTemplate_idx" ON "Merchant"("industryTemplate");

-- 历史回填：仅服装行业包 → 服装生产批发商模板，保证既有商家继续进入同一后台。
UPDATE "Merchant"
SET "industryTemplate" = 'apparel_production_wholesale',
    "industryTemplateSource" = 'LEGACY_MIGRATED',
    "industryTemplateInitializedAt" = NOW()
WHERE "industryTemplate" IS NULL
  AND "industry" = 'FASHION_COMPANY';

-- 其余历史行业保持 industryTemplate = NULL / LEGACY_PENDING_REVIEW：
-- 服务端按“历史兼容”放行现有账号，不在此处猜测其经营类型。
