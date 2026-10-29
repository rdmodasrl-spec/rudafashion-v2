CREATE TABLE IF NOT EXISTS "AppCategory" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "icon" VARCHAR(48) NOT NULL DEFAULT 'Package',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "App" (
    "id" TEXT NOT NULL,
    "appId" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "detailedIntro" TEXT,
    "icon" VARCHAR(48) NOT NULL DEFAULT 'Package',
    "categoryId" TEXT NOT NULL,
    "version" VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
    "pricingType" VARCHAR(24) NOT NULL DEFAULT 'free',
    "pricePlan" JSONB NOT NULL DEFAULT '{}',
    "developer" VARCHAR(160) NOT NULL DEFAULT 'RUDA FASHION',
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "features" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AppInstallation" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'installed',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppInstallation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppCategory_slug_key" ON "AppCategory"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "App_appId_key" ON "App"("appId");
CREATE UNIQUE INDEX IF NOT EXISTS "App_slug_key" ON "App"("slug");
CREATE INDEX IF NOT EXISTS "App_categoryId_status_idx" ON "App"("categoryId", "status");
CREATE INDEX IF NOT EXISTS "App_status_updatedAt_idx" ON "App"("status", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AppInstallation_merchantId_appId_key" ON "AppInstallation"("merchantId", "appId");
CREATE INDEX IF NOT EXISTS "AppInstallation_merchantId_status_idx" ON "AppInstallation"("merchantId", "status");

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'App_categoryId_fkey' AND conrelid = '"App"'::regclass
    ) THEN
        ALTER TABLE "App"
        ADD CONSTRAINT "App_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "AppCategory"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AppInstallation_merchantId_fkey' AND conrelid = '"AppInstallation"'::regclass
    ) THEN
        ALTER TABLE "AppInstallation"
        ADD CONSTRAINT "AppInstallation_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AppInstallation_appId_fkey' AND conrelid = '"AppInstallation"'::regclass
    ) THEN
        ALTER TABLE "AppInstallation"
        ADD CONSTRAINT "AppInstallation_appId_fkey"
        FOREIGN KEY ("appId") REFERENCES "App"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$migration$;
