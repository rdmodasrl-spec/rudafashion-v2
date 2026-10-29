ALTER TABLE "MerchantModaGptDesign"
ADD COLUMN "imageStorageBucket" TEXT,
ADD COLUMN "imageSizeBytes" INTEGER;

ALTER TABLE "Merchant"
ADD COLUMN "storefrontMediaItems" JSONB;
