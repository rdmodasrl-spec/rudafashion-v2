CREATE TABLE "AccountIdentity" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3) NOT NULL,
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountIdentity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuthAccount"
    ADD COLUMN "identityId" TEXT,
    ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "AccountIdentity_email_key" ON "AccountIdentity"("email");
CREATE UNIQUE INDEX "AccountIdentity_phone_key" ON "AccountIdentity"("phone");
CREATE INDEX "AccountIdentity_emailVerifiedAt_idx" ON "AccountIdentity"("emailVerifiedAt");
CREATE INDEX "AccountIdentity_phoneVerifiedAt_idx" ON "AccountIdentity"("phoneVerifiedAt");
CREATE INDEX "AuthAccount_identityId_idx" ON "AuthAccount"("identityId");
CREATE INDEX "AuthAccount_emailVerifiedAt_idx" ON "AuthAccount"("emailVerifiedAt");

ALTER TABLE "AuthAccount"
    ADD CONSTRAINT "AuthAccount_identityId_fkey"
    FOREIGN KEY ("identityId") REFERENCES "AccountIdentity"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
