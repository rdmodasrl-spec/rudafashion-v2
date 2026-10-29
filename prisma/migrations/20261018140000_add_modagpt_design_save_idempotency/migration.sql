ALTER TABLE "MerchantModaGptDesign"
ADD COLUMN "clientRequestId" VARCHAR(128),
ADD COLUMN "requestPayloadHash" VARCHAR(64);

CREATE UNIQUE INDEX "MerchantModaGptDesign_merchantId_clientRequestId_key"
ON "MerchantModaGptDesign"("merchantId", "clientRequestId");
