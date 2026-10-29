ALTER TABLE "Merchant"
ADD COLUMN "storefrontAiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "storefrontAiActivatedAt" TIMESTAMP(3),
ADD COLUMN "storefrontAiActivatedBy" TEXT;
