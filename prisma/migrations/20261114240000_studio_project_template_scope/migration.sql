DROP INDEX "MerchantStudioProject_merchantId_studioCode_clientRequestId_key";

CREATE UNIQUE INDEX "MerchantStudioProject_tenant_template_request_key"
  ON "MerchantStudioProject"("merchantId", "industryTemplate", "studioCode", "clientRequestId");
