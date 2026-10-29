ALTER TABLE "Merchant"
  ADD COLUMN "storefrontSeoTitle" VARCHAR(70) NOT NULL DEFAULT '',
  ADD COLUMN "storefrontSeoDescription" VARCHAR(320) NOT NULL DEFAULT '',
  ADD COLUMN "storefrontShippingPolicy" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "storefrontReturnsPolicy" TEXT NOT NULL DEFAULT '';
