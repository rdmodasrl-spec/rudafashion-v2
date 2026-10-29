ALTER TABLE "AuthAccount"
ADD COLUMN "consumerId" TEXT;

CREATE UNIQUE INDEX "AuthAccount_consumerId_key"
ON "AuthAccount"("consumerId");

ALTER TABLE "AuthAccount"
ADD CONSTRAINT "AuthAccount_consumerId_fkey"
FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
