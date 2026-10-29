-- 行业清单（src/constants/merchantIndustries.ts）已包含 LEATHER_GOODS（箱包批发），
-- 但 20261002091000 的 CHECK 约束未同步，导致箱包批发商模板在创建商家时被数据库拒绝。
-- 幂等：先删后加；仅放宽取值范围，不修改任何既有行。

ALTER TABLE "Merchant" DROP CONSTRAINT IF EXISTS "Merchant_industry_check";

ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_industry_check"
CHECK ("industry" IN (
  'FASHION_COMPANY',
  'FASHION_WHOLESALE',
  'LEATHER_GOODS',
  'DEPARTMENT_STORE',
  'RETAIL_STORE',
  'TRADING_COMPANY',
  'WHOLESALE_COMPANY',
  'RESTAURANT',
  'OTHER'
));
