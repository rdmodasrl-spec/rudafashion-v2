CREATE SEQUENCE "partner_agent_code_seq" START WITH 1;
CREATE SEQUENCE "partner_city_code_seq" START WITH 1;
CREATE SEQUENCE "partner_network_code_seq" START WITH 1;

CREATE TABLE "Partner" (
  "id" TEXT NOT NULL,
  "partnerCode" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "telegramId" TEXT,
  "country" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "region" TEXT NOT NULL DEFAULT '',
  "language" TEXT NOT NULL DEFAULT 'en',
  "parentId" TEXT,
  "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "cityCommissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "partnerCommissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Partner_role_check" CHECK ("role" IN ('agent', 'city_agent', 'partner')),
  CONSTRAINT "Partner_status_check" CHECK ("status" IN ('pending', 'active', 'paused', 'disabled')),
  CONSTRAINT "Partner_commission_rate_check" CHECK (
    "commissionRate" >= 0 AND "commissionRate" <= 100 AND
    "cityCommissionRate" >= 0 AND "cityCommissionRate" <= 100 AND
    "partnerCommissionRate" >= 0 AND "partnerCommissionRate" <= 100
  )
);

CREATE TABLE "PartnerCampaign" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "campaignCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerCampaign_status_check" CHECK ("status" IN ('active', 'paused', 'ended'))
);

CREATE TABLE "PartnerReferralClick" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "campaignId" TEXT,
  "visitorKeyHash" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'link',
  "landingPath" TEXT,
  "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerReferralClick_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerReferral" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "cityPartnerId" TEXT,
  "networkPartnerId" TEXT,
  "campaignId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'link',
  "landingPath" TEXT,
  "firstClickAt" TIMESTAMP(3),
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firstPaidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerReferral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerReferralChange" (
  "id" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "previousPartnerId" TEXT,
  "newPartnerId" TEXT NOT NULL,
  "operatorId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerReferralChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerCommissionEntry" (
  "id" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "entryType" TEXT NOT NULL DEFAULT 'commission',
  "basisAmount" DECIMAL(14,2) NOT NULL,
  "rate" DECIMAL(5,2) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "idempotencyKey" TEXT NOT NULL,
  "sourceRefundId" TEXT,
  "reversalOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerCommissionEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerCommissionEntry_amount_check" CHECK (
    "basisAmount" >= 0 AND "rate" >= 0 AND "rate" <= 100 AND
    (("entryType" = 'commission' AND "sourceRefundId" IS NULL AND "reversalOfId" IS NULL AND "amount" >= 0) OR
     ("entryType" = 'reversal' AND "sourceRefundId" IS NOT NULL AND "reversalOfId" IS NOT NULL AND "amount" <= 0))
  ),
  CONSTRAINT "PartnerCommissionEntry_status_check" CHECK ("status" IN ('pending', 'approved', 'available', 'paid', 'cancelled'))
);

CREATE TABLE "PartnerAuditEvent" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT,
  "operatorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerAuditEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuthAccount" ADD COLUMN "partnerId" TEXT;
ALTER TABLE "Order" ADD COLUMN "partnerReferralId" TEXT;
ALTER TABLE "Order"
  ADD COLUMN "partnerId" TEXT,
  ADD COLUMN "partnerCityAgentId" TEXT,
  ADD COLUMN "partnerNetworkId" TEXT;

CREATE UNIQUE INDEX "Partner_partnerCode_key" ON "Partner"("partnerCode");
CREATE INDEX "Partner_parentId_role_status_idx" ON "Partner"("parentId", "role", "status");
CREATE INDEX "Partner_role_status_idx" ON "Partner"("role", "status");
CREATE INDEX "Partner_country_city_idx" ON "Partner"("country", "city");
CREATE INDEX "Partner_email_idx" ON "Partner"("email");

CREATE UNIQUE INDEX "PartnerCampaign_campaignCode_key" ON "PartnerCampaign"("campaignCode");
CREATE INDEX "PartnerCampaign_partnerId_status_createdAt_idx" ON "PartnerCampaign"("partnerId", "status", "createdAt");

CREATE INDEX "PartnerReferralClick_partnerId_visitorKeyHash_clickedAt_idx" ON "PartnerReferralClick"("partnerId", "visitorKeyHash", "clickedAt");
CREATE INDEX "PartnerReferralClick_partnerId_clickedAt_idx" ON "PartnerReferralClick"("partnerId", "clickedAt");
CREATE INDEX "PartnerReferralClick_campaignId_clickedAt_idx" ON "PartnerReferralClick"("campaignId", "clickedAt");

CREATE UNIQUE INDEX "PartnerReferral_customerId_key" ON "PartnerReferral"("customerId");
CREATE INDEX "PartnerReferral_partnerId_registeredAt_idx" ON "PartnerReferral"("partnerId", "registeredAt");
CREATE INDEX "PartnerReferral_cityPartnerId_registeredAt_idx" ON "PartnerReferral"("cityPartnerId", "registeredAt");
CREATE INDEX "PartnerReferral_networkPartnerId_registeredAt_idx" ON "PartnerReferral"("networkPartnerId", "registeredAt");
CREATE INDEX "PartnerReferral_campaignId_registeredAt_idx" ON "PartnerReferral"("campaignId", "registeredAt");

CREATE INDEX "PartnerReferralChange_referralId_createdAt_idx" ON "PartnerReferralChange"("referralId", "createdAt");
CREATE INDEX "PartnerReferralChange_operatorId_createdAt_idx" ON "PartnerReferralChange"("operatorId", "createdAt");

CREATE UNIQUE INDEX "PartnerCommissionEntry_idempotencyKey_key" ON "PartnerCommissionEntry"("idempotencyKey");
CREATE INDEX "PartnerCommissionEntry_partnerId_status_createdAt_idx" ON "PartnerCommissionEntry"("partnerId", "status", "createdAt");
CREATE INDEX "PartnerCommissionEntry_orderId_idx" ON "PartnerCommissionEntry"("orderId");
CREATE INDEX "PartnerCommissionEntry_sourceRefundId_idx" ON "PartnerCommissionEntry"("sourceRefundId");
CREATE INDEX "PartnerCommissionEntry_reversalOfId_idx" ON "PartnerCommissionEntry"("reversalOfId");

CREATE INDEX "PartnerAuditEvent_partnerId_createdAt_idx" ON "PartnerAuditEvent"("partnerId", "createdAt");
CREATE INDEX "PartnerAuditEvent_entityType_entityId_createdAt_idx" ON "PartnerAuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "PartnerAuditEvent_operatorId_createdAt_idx" ON "PartnerAuditEvent"("operatorId", "createdAt");

CREATE UNIQUE INDEX "AuthAccount_partnerId_key" ON "AuthAccount"("partnerId");
CREATE INDEX "Order_partnerReferralId_idx" ON "Order"("partnerReferralId");
CREATE INDEX "Order_partnerId_idx" ON "Order"("partnerId");
CREATE INDEX "Order_partnerCityAgentId_idx" ON "Order"("partnerCityAgentId");
CREATE INDEX "Order_partnerNetworkId_idx" ON "Order"("partnerNetworkId");

ALTER TABLE "Partner" ADD CONSTRAINT "Partner_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerCampaign" ADD CONSTRAINT "PartnerCampaign_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerReferralClick" ADD CONSTRAINT "PartnerReferralClick_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerReferralClick" ADD CONSTRAINT "PartnerReferralClick_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "PartnerCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_cityPartnerId_fkey"
  FOREIGN KEY ("cityPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_networkPartnerId_fkey"
  FOREIGN KEY ("networkPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "PartnerCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerReferralChange" ADD CONSTRAINT "PartnerReferralChange_referralId_fkey"
  FOREIGN KEY ("referralId") REFERENCES "PartnerReferral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerCommissionEntry" ADD CONSTRAINT "PartnerCommissionEntry_referralId_fkey"
  FOREIGN KEY ("referralId") REFERENCES "PartnerReferral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerCommissionEntry" ADD CONSTRAINT "PartnerCommissionEntry_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerCommissionEntry" ADD CONSTRAINT "PartnerCommissionEntry_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerCommissionEntry" ADD CONSTRAINT "PartnerCommissionEntry_sourceRefundId_fkey"
  FOREIGN KEY ("sourceRefundId") REFERENCES "RefundTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerCommissionEntry" ADD CONSTRAINT "PartnerCommissionEntry_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId") REFERENCES "PartnerCommissionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerAuditEvent" ADD CONSTRAINT "PartnerAuditEvent_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerReferralId_fkey"
  FOREIGN KEY ("partnerReferralId") REFERENCES "PartnerReferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerCityAgentId_fkey"
  FOREIGN KEY ("partnerCityAgentId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerNetworkId_fkey"
  FOREIGN KEY ("partnerNetworkId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
