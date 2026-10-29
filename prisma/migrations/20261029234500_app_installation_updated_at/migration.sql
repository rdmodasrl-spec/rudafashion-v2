-- 修复生态应用安装表与 Prisma schema 的结构漂移：
-- 早期建表缺少 updatedAt，导致 POST /api/app-store/installations 直接 500。
-- 仅新增列，默认当前时间；历史安装记录（若有）会被填充为迁移时间。
ALTER TABLE "AppInstallation"
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
