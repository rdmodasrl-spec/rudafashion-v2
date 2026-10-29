CREATE TABLE "MiniProgramIdentity" (
    "id" TEXT NOT NULL,
    "appId" VARCHAR(64) NOT NULL,
    "openId" VARCHAR(128) NOT NULL,
    "authAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniProgramIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MiniProgramIdentity_appId_openId_key"
    ON "MiniProgramIdentity"("appId", "openId");

CREATE UNIQUE INDEX "MiniProgramIdentity_appId_authAccountId_key"
    ON "MiniProgramIdentity"("appId", "authAccountId");

CREATE INDEX "MiniProgramIdentity_authAccountId_idx"
    ON "MiniProgramIdentity"("authAccountId");

ALTER TABLE "MiniProgramIdentity"
    ADD CONSTRAINT "MiniProgramIdentity_authAccountId_fkey"
    FOREIGN KEY ("authAccountId") REFERENCES "AuthAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
