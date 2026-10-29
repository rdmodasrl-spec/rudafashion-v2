CREATE TABLE "MerchantModaGptDesign" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "prompt" VARCHAR(1000) NOT NULL,
    "category" VARCHAR(24) NOT NULL,
    "imageStorageKey" TEXT NOT NULL,
    "imageMime" VARCHAR(32) NOT NULL DEFAULT 'image/webp',
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantModaGptDesign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantModaGptDesign_imageStorageKey_key"
ON "MerchantModaGptDesign"("imageStorageKey");

CREATE INDEX "MerchantModaGptDesign_merchantId_createdAt_idx"
ON "MerchantModaGptDesign"("merchantId", "createdAt");

CREATE INDEX "MerchantModaGptDesign_merchantId_category_createdAt_idx"
ON "MerchantModaGptDesign"("merchantId", "category", "createdAt");

ALTER TABLE "MerchantModaGptDesign"
ADD CONSTRAINT "MerchantModaGptDesign_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
