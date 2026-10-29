ALTER TABLE "AppInstallation"
ADD COLUMN IF NOT EXISTS "installedVersion" VARCHAR(32);

UPDATE "App"
SET
  "name" = '邮箱域名配置',
  "description" = '免费添加域名并验证所有权；不提供邮箱账户或邮件收发。',
  "detailedIntro" = '使用 DNS TXT 记录验证企业域名所有权。RUDA 尚未连接邮箱托管服务，因此不提供邮箱账户、Webmail、IMAP/SMTP 或邮件收发。',
  "version" = '1.0.0',
  "status" = 'published',
  "pricingType" = 'free',
  "pricePlan" = '{}'::jsonb,
  "permissions" = '["domain.manage"]',
  "features" = '["域名添加","DNS TXT 所有权验证"]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "appId" = 'ruda-business-email';

UPDATE "AppInstallation" AS installation
SET "status" = 'disabled'
FROM "App" AS app
WHERE installation."appId" = app."id"
  AND app."appId" = 'ruda-business-email'
  AND installation."status" = 'active';
