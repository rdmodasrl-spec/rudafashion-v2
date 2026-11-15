-- MODAUI 广告策划器（P1 商家端四屏）：为广告工程保存商家补充的商品图片。
-- 纯新增可空列；不改既有列、不回填数据，旧代码不读取该列。
-- 回滚：ALTER TABLE "AiAdProject" DROP COLUMN IF EXISTS "supplementImages";（图片本体在对象存储，本列只存 URL）
ALTER TABLE "AiAdProject" ADD COLUMN IF NOT EXISTS "supplementImages" JSONB;
