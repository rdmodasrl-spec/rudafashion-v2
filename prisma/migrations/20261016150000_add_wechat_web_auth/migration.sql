ALTER TABLE "AuthAccount" ADD COLUMN "wechatOpenId" TEXT;

CREATE UNIQUE INDEX "AuthAccount_wechatOpenId_key" ON "AuthAccount"("wechatOpenId");
