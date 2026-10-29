ALTER TABLE "AccountIdentity"
ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'public';

ALTER TABLE "AccountIdentity"
ALTER COLUMN "emailVerifiedAt" DROP NOT NULL;

DROP INDEX "AccountIdentity_email_key";

CREATE UNIQUE INDEX "AccountIdentity_scope_email_key"
ON "AccountIdentity"("scope", "email");

ALTER TABLE "MerchantEmployee"
ADD COLUMN "identityId" TEXT;

CREATE INDEX "MerchantEmployee_identityId_active_idx"
ON "MerchantEmployee"("identityId", "active");

ALTER TABLE "MerchantEmployee"
ADD CONSTRAINT "MerchantEmployee_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "AccountIdentity"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
