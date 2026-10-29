CREATE TABLE "PartnerMerchantReferral" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "cityPartnerId" TEXT,
  "campaignId" TEXT,
  "source" VARCHAR(24) NOT NULL DEFAULT 'link',
  "directRoleAttribution" VARCHAR(24) NOT NULL,
  "directRate" DECIMAL(5,2) NOT NULL,
  "cityRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "commissionWindowMonths" INTEGER NOT NULL DEFAULT 12,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firstPaidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerMerchantReferral_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerMerchantReferral_directRate_check" CHECK ("directRate" >= 0 AND "directRate" <= 100),
  CONSTRAINT "PartnerMerchantReferral_cityRate_check" CHECK ("cityRate" >= 0 AND "cityRate" <= 100),
  CONSTRAINT "PartnerMerchantReferral_commissionWindow_check" CHECK ("commissionWindowMonths" BETWEEN 1 AND 12)
);
CREATE UNIQUE INDEX "PartnerMerchantReferral_merchantId_key" ON "PartnerMerchantReferral"("merchantId");
CREATE INDEX "PartnerMerchantReferral_partnerId_registeredAt_idx" ON "PartnerMerchantReferral"("partnerId", "registeredAt");
CREATE INDEX "PartnerMerchantReferral_cityPartnerId_registeredAt_idx" ON "PartnerMerchantReferral"("cityPartnerId", "registeredAt");
CREATE INDEX "PartnerMerchantReferral_campaignId_registeredAt_idx" ON "PartnerMerchantReferral"("campaignId", "registeredAt");
CREATE INDEX "PartnerMerchantReferral_firstPaidAt_idx" ON "PartnerMerchantReferral"("firstPaidAt");
ALTER TABLE "PartnerMerchantReferral" ADD CONSTRAINT "PartnerMerchantReferral_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerMerchantReferral" ADD CONSTRAINT "PartnerMerchantReferral_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerMerchantReferral" ADD CONSTRAINT "PartnerMerchantReferral_cityPartnerId_fkey"
  FOREIGN KEY ("cityPartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerMerchantReferral" ADD CONSTRAINT "PartnerMerchantReferral_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "PartnerCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PartnerCityApplication" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "companyName" VARCHAR(160) NOT NULL,
  "contactName" VARCHAR(120) NOT NULL,
  "country" VARCHAR(80) NOT NULL,
  "city" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(40) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "reviewNote" VARCHAR(500),
  "reviewedBy" VARCHAR(120),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerCityApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerCityApplication_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'paused'))
);
CREATE UNIQUE INDEX "PartnerCityApplication_partnerId_key" ON "PartnerCityApplication"("partnerId");
CREATE INDEX "PartnerCityApplication_status_createdAt_idx" ON "PartnerCityApplication"("status", "createdAt");
ALTER TABLE "PartnerCityApplication" ADD CONSTRAINT "PartnerCityApplication_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PartnerAgentInvite" (
  "id" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "redeemedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerAgentInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerAgentInvite_tokenHash_key" ON "PartnerAgentInvite"("tokenHash");
CREATE INDEX "PartnerAgentInvite_inviterId_createdAt_idx" ON "PartnerAgentInvite"("inviterId", "createdAt");
ALTER TABLE "PartnerAgentInvite" ADD CONSTRAINT "PartnerAgentInvite_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PartnerProgramConfig" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'default',
  "agentRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
  "cityDirectRate" DECIMAL(5,2) NOT NULL DEFAULT 25,
  "cityTeamRate" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "minimumSettlementMinor" INTEGER NOT NULL DEFAULT 5000,
  "commissionWindowMonths" INTEGER NOT NULL DEFAULT 12,
  "updatedBy" VARCHAR(120),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerProgramConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerProgramConfig_rates_check" CHECK (
    "agentRate" BETWEEN 0 AND 100 AND "cityDirectRate" BETWEEN 0 AND 100
    AND "cityTeamRate" BETWEEN 0 AND 100 AND "cityDirectRate" + "cityTeamRate" <= 100
  ),
  CONSTRAINT "PartnerProgramConfig_settlement_check" CHECK (
    "minimumSettlementMinor" >= 0 AND "commissionWindowMonths" BETWEEN 1 AND 12
  )
);
INSERT INTO "PartnerProgramConfig" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "PartnerSettlementRequest" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "paymentReference" VARCHAR(160),
  "reviewNote" VARCHAR(500),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" VARCHAR(120),
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "PartnerSettlementRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerSettlementRequest_amount_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "PartnerSettlementRequest_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'paid'))
);
CREATE INDEX "PartnerSettlementRequest_partnerId_status_requestedAt_idx"
  ON "PartnerSettlementRequest"("partnerId", "status", "requestedAt");
CREATE INDEX "PartnerSettlementRequest_status_requestedAt_idx"
  ON "PartnerSettlementRequest"("status", "requestedAt");
ALTER TABLE "PartnerSettlementRequest" ADD CONSTRAINT "PartnerSettlementRequest_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PartnerSubscriptionCommissionEntry" (
  "id" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "role" VARCHAR(24) NOT NULL,
  "entryType" VARCHAR(24) NOT NULL DEFAULT 'commission',
  "basisMinor" INTEGER NOT NULL,
  "rate" DECIMAL(5,2) NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "reversalOfId" TEXT,
  "settlementRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerSubscriptionCommissionEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerSubscriptionCommissionEntry_amount_check" CHECK (
    "basisMinor" >= 0 AND "rate" BETWEEN 0 AND 100
    AND (("entryType" = 'commission' AND "reversalOfId" IS NULL AND "amountMinor" >= 0)
      OR ("entryType" = 'reversal' AND "reversalOfId" IS NOT NULL AND "amountMinor" <= 0))
  ),
  CONSTRAINT "PartnerSubscriptionCommissionEntry_status_check"
    CHECK ("status" IN ('pending', 'approved', 'available', 'paid', 'cancelled'))
);
CREATE UNIQUE INDEX "PartnerSubscriptionCommissionEntry_idempotencyKey_key"
  ON "PartnerSubscriptionCommissionEntry"("idempotencyKey");
CREATE INDEX "PartnerSubscriptionCommissionEntry_partnerId_status_createdAt_idx"
  ON "PartnerSubscriptionCommissionEntry"("partnerId", "status", "createdAt");
CREATE INDEX "PartnerSubscriptionCommissionEntry_invoiceId_idx"
  ON "PartnerSubscriptionCommissionEntry"("invoiceId");
CREATE INDEX "PartnerSubscriptionCommissionEntry_referralId_createdAt_idx"
  ON "PartnerSubscriptionCommissionEntry"("referralId", "createdAt");
CREATE INDEX "PartnerSubscriptionCommissionEntry_reversalOfId_idx"
  ON "PartnerSubscriptionCommissionEntry"("reversalOfId");
CREATE INDEX "PartnerSubscriptionCommissionEntry_settlementRequestId_idx"
  ON "PartnerSubscriptionCommissionEntry"("settlementRequestId");
ALTER TABLE "PartnerSubscriptionCommissionEntry" ADD CONSTRAINT "PartnerSubscriptionCommissionEntry_referralId_fkey"
  FOREIGN KEY ("referralId") REFERENCES "PartnerMerchantReferral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerSubscriptionCommissionEntry" ADD CONSTRAINT "PartnerSubscriptionCommissionEntry_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "ModaGptBillingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerSubscriptionCommissionEntry" ADD CONSTRAINT "PartnerSubscriptionCommissionEntry_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerSubscriptionCommissionEntry" ADD CONSTRAINT "PartnerSubscriptionCommissionEntry_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId") REFERENCES "PartnerSubscriptionCommissionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerSubscriptionCommissionEntry" ADD CONSTRAINT "PartnerSubscriptionCommissionEntry_settlementRequestId_fkey"
  FOREIGN KEY ("settlementRequestId") REFERENCES "PartnerSettlementRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ModaGptBillingPlan"
  ("id", "displayName", "monthlyPriceMinor", "currency", "interval", "status", "purchaseEnabled", "featured", "recommended", "monthlyCredits", "rolloverPolicy", "expirationPolicy", "featureEntitlements", "usageLimits", "version", "createdAt", "updatedAt")
SELECT 'PLUS_YEAR', 'Plus Annual', 19000, "currency", 'year', "status", "purchaseEnabled", false, false, "monthlyCredits", "rolloverPolicy", 'period_end', "featureEntitlements", "usageLimits", 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ModaGptBillingPlan" WHERE "id" = 'PLUS'
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ModaGptBillingPlan"
  ("id", "displayName", "monthlyPriceMinor", "currency", "interval", "status", "purchaseEnabled", "featured", "recommended", "monthlyCredits", "rolloverPolicy", "expirationPolicy", "featureEntitlements", "usageLimits", "version", "createdAt", "updatedAt")
SELECT 'PRO_YEAR', 'Pro Annual', 49000, "currency", 'year', "status", "purchaseEnabled", false, false, "monthlyCredits", "rolloverPolicy", 'period_end', "featureEntitlements", "usageLimits", 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ModaGptBillingPlan" WHERE "id" = 'PRO'
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ModaGptBillingPlan"
  ("id", "displayName", "monthlyPriceMinor", "currency", "interval", "status", "purchaseEnabled", "featured", "recommended", "monthlyCredits", "rolloverPolicy", "expirationPolicy", "featureEntitlements", "usageLimits", "version", "createdAt", "updatedAt")
SELECT 'BUSINESS_YEAR', 'Business Annual', 99000, "currency", 'year', "status", "purchaseEnabled", false, false, "monthlyCredits", "rolloverPolicy", 'period_end', "featureEntitlements", "usageLimits", 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ModaGptBillingPlan" WHERE "id" = 'BUSINESS'
ON CONFLICT ("id") DO NOTHING;
