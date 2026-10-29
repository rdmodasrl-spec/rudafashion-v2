CREATE TABLE "Consumer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "birthday" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "preferredLang" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "points" INTEGER NOT NULL DEFAULT 0,
    "level" TEXT NOT NULL DEFAULT 'silver',
    "totalSpent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
    "addresses" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    CONSTRAINT "Consumer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Consumer_email_key" ON "Consumer"("email");
CREATE INDEX "Consumer_phone_idx" ON "Consumer"("phone");
CREATE INDEX "Consumer_status_idx" ON "Consumer"("status");

CREATE TABLE "FashionAccount" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FashionAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FashionAccountIdentity" (
    "id" TEXT NOT NULL,
    "fashionAccountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FashionAccountIdentity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FashionCommunityPost"
ADD COLUMN "creatorAccountId" TEXT;

CREATE UNIQUE INDEX "FashionAccountIdentity_provider_providerUserId_key"
ON "FashionAccountIdentity"("provider", "providerUserId");

CREATE INDEX "FashionAccountIdentity_fashionAccountId_idx"
ON "FashionAccountIdentity"("fashionAccountId");

CREATE INDEX "FashionCommunityPost_creatorAccountId_createdAt_idx"
ON "FashionCommunityPost"("creatorAccountId", "createdAt");

ALTER TABLE "FashionAccountIdentity"
ADD CONSTRAINT "FashionAccountIdentity_fashionAccountId_fkey"
FOREIGN KEY ("fashionAccountId") REFERENCES "FashionAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FashionCommunityPost"
ADD CONSTRAINT "FashionCommunityPost_creatorAccountId_fkey"
FOREIGN KEY ("creatorAccountId") REFERENCES "FashionAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
