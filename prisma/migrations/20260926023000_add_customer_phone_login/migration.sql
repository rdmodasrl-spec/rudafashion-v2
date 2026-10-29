ALTER TABLE "AuthAccount" ADD COLUMN "phone" TEXT;
CREATE UNIQUE INDEX "AuthAccount_role_phone_key" ON "AuthAccount"("role", "phone");
