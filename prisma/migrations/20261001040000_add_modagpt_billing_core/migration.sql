CREATE TABLE "ModaGptBillingPlan" (
  "id" VARCHAR(32) NOT NULL,
  "displayName" VARCHAR(80) NOT NULL,
  "monthlyPriceMinor" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "interval" VARCHAR(16) NOT NULL DEFAULT 'month',
  "status" VARCHAR(24) NOT NULL DEFAULT 'active',
  "purchaseEnabled" BOOLEAN NOT NULL DEFAULT false,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "recommended" BOOLEAN NOT NULL DEFAULT false,
  "monthlyCredits" INTEGER,
  "rolloverPolicy" VARCHAR(24) NOT NULL DEFAULT 'none',
  "expirationPolicy" VARCHAR(24) NOT NULL DEFAULT 'period_end',
  "featureEntitlements" TEXT NOT NULL DEFAULT '{}',
  "usageLimits" TEXT NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModaGptBillingPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModaGptBillingPlan_status_monthlyPriceMinor_idx"
ON "ModaGptBillingPlan"("status", "monthlyPriceMinor");

INSERT INTO "ModaGptBillingPlan"
  ("id", "displayName", "monthlyPriceMinor", "currency", "interval", "status", "purchaseEnabled", "featured", "recommended", "monthlyCredits", "rolloverPolicy", "expirationPolicy", "featureEntitlements", "usageLimits", "version", "updatedAt")
VALUES
  ('FREE', 'Free', 0, 'EUR', 'month', 'active', false, false, false, NULL, 'none', 'period_end',
   '{"ai.basic_chat":true}', '{}', 1, CURRENT_TIMESTAMP),
  ('PLUS', 'Plus', 1900, 'EUR', 'month', 'active', false, false, false, NULL, 'none', 'period_end',
   '{"ai.basic_chat":true,"ai.product":true,"ai.image":true}', '{}', 1, CURRENT_TIMESTAMP),
  ('PRO', 'Pro', 4900, 'EUR', 'month', 'active', false, false, false, NULL, 'none', 'period_end',
   '{"ai.basic_chat":true,"ai.advanced_reasoning":true,"ai.product":true,"ai.inventory":true,"ai.sales":true,"ai.automation":true,"ai.workflow":true,"ai.image":true,"ai.design":true,"knowledge_base":true,"advanced_analytics":true}', '{}', 1, CURRENT_TIMESTAMP),
  ('BUSINESS', 'Business', 9900, 'EUR', 'month', 'active', false, true, true, NULL, 'none', 'period_end',
   '{"ai.basic_chat":true,"ai.advanced_reasoning":true,"ai.product":true,"ai.inventory":true,"ai.sales":true,"ai.finance":true,"ai.automation":true,"ai.workflow":true,"ai.image":true,"ai.design":true,"payment.channels":true,"payment.collection":true,"payment.payout":true,"payment.refund":true,"multi_store":true,"team":true,"knowledge_base":true,"advanced_analytics":true}', '{}', 1, CURRENT_TIMESTAMP),
  ('FASHION_PRO', 'Fashion Pro', 15900, 'EUR', 'month', 'active', false, false, false, NULL, 'none', 'period_end',
   '{"ai.basic_chat":true,"ai.advanced_reasoning":true,"ai.product":true,"ai.inventory":true,"ai.sales":true,"ai.automation":true,"ai.workflow":true,"ai.image":true,"ai.image_advanced":true,"ai.try_on":true,"ai.video":true,"ai.design":true,"ai.batch_creative":true,"knowledge_base":true,"advanced_analytics":true}', '{}', 1, CURRENT_TIMESTAMP);

CREATE TABLE "ModaGptBillingSubscription" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "planId" VARCHAR(32) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  "provider" VARCHAR(24),
  "providerCustomerId" VARCHAR(160),
  "providerSubscriptionId" VARCHAR(160),
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "planSnapshot" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModaGptBillingSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModaGptBillingSubscription_providerSubscriptionId_key"
ON "ModaGptBillingSubscription"("providerSubscriptionId");
CREATE UNIQUE INDEX "ModaGptBillingSubscription_idempotencyKey_key"
ON "ModaGptBillingSubscription"("idempotencyKey");
CREATE INDEX "ModaGptBillingSubscription_merchantId_status_currentPeriodEnd_idx"
ON "ModaGptBillingSubscription"("merchantId", "status", "currentPeriodEnd");
CREATE INDEX "ModaGptBillingSubscription_planId_status_idx"
ON "ModaGptBillingSubscription"("planId", "status");
ALTER TABLE "ModaGptBillingSubscription"
ADD CONSTRAINT "ModaGptBillingSubscription_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModaGptBillingSubscription"
ADD CONSTRAINT "ModaGptBillingSubscription_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "ModaGptBillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ModaGptBillingFeature" (
  "featureKey" VARCHAR(64) NOT NULL,
  "minimumPlan" VARCHAR(32),
  "creditCost" INTEGER,
  "riskLevel" VARCHAR(16) NOT NULL DEFAULT 'LOW',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" TEXT NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModaGptBillingFeature_pkey" PRIMARY KEY ("featureKey")
);
CREATE INDEX "ModaGptBillingFeature_enabled_minimumPlan_idx"
ON "ModaGptBillingFeature"("enabled", "minimumPlan");

INSERT INTO "ModaGptBillingFeature"
  ("featureKey", "minimumPlan", "creditCost", "riskLevel", "enabled", "config", "version", "updatedAt")
VALUES
  ('ai.basic_chat', 'FREE', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.advanced_reasoning', 'PRO', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.product', 'PLUS', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.inventory', 'PRO', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.sales', 'PRO', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.finance', 'BUSINESS', NULL, 'MEDIUM', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.automation', 'PRO', NULL, 'MEDIUM', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.workflow', 'PRO', NULL, 'MEDIUM', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.image', 'PLUS', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.image_advanced', 'FASHION_PRO', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.try_on', 'FASHION_PRO', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.video', 'FASHION_PRO', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.voice', 'PLUS', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.design', 'PRO', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('ai.batch_creative', 'FASHION_PRO', NULL, 'MEDIUM', false, '{}', 1, CURRENT_TIMESTAMP),
  ('payment.channels', 'BUSINESS', NULL, 'HIGH', false, '{}', 1, CURRENT_TIMESTAMP),
  ('payment.collection', 'BUSINESS', NULL, 'HIGH', false, '{}', 1, CURRENT_TIMESTAMP),
  ('payment.payout', 'BUSINESS', NULL, 'CRITICAL', false, '{}', 1, CURRENT_TIMESTAMP),
  ('payment.refund', 'BUSINESS', NULL, 'CRITICAL', false, '{}', 1, CURRENT_TIMESTAMP),
  ('multi_store', 'BUSINESS', NULL, 'MEDIUM', false, '{}', 1, CURRENT_TIMESTAMP),
  ('team', 'BUSINESS', NULL, 'MEDIUM', false, '{}', 1, CURRENT_TIMESTAMP),
  ('knowledge_base', 'PRO', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP),
  ('advanced_analytics', 'PRO', NULL, 'LOW', false, '{}', 1, CURRENT_TIMESTAMP);

CREATE TABLE "ModaGptCreditReservation" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "feature" VARCHAR(64) NOT NULL,
  "credits" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'reserved',
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModaGptCreditReservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModaGptCreditReservation_merchantId_idempotencyKey_key"
ON "ModaGptCreditReservation"("merchantId", "idempotencyKey");
CREATE INDEX "ModaGptCreditReservation_merchantId_status_expiresAt_idx"
ON "ModaGptCreditReservation"("merchantId", "status", "expiresAt");
ALTER TABLE "ModaGptCreditReservation"
ADD CONSTRAINT "ModaGptCreditReservation_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ModaGptCreditLedgerEntry" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "actorId" TEXT,
  "entryType" VARCHAR(24) NOT NULL,
  "amount" INTEGER NOT NULL,
  "referenceType" VARCHAR(48) NOT NULL,
  "referenceId" VARCHAR(160) NOT NULL,
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reservationId" TEXT,
  CONSTRAINT "ModaGptCreditLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModaGptCreditLedgerEntry_idempotencyKey_key"
ON "ModaGptCreditLedgerEntry"("idempotencyKey");
CREATE INDEX "ModaGptCreditLedgerEntry_merchantId_createdAt_idx"
ON "ModaGptCreditLedgerEntry"("merchantId", "createdAt");
CREATE INDEX "ModaGptCreditLedgerEntry_merchantId_referenceType_referenceId_idx"
ON "ModaGptCreditLedgerEntry"("merchantId", "referenceType", "referenceId");
CREATE INDEX "ModaGptCreditLedgerEntry_reservationId_entryType_idx"
ON "ModaGptCreditLedgerEntry"("reservationId", "entryType");
ALTER TABLE "ModaGptCreditLedgerEntry"
ADD CONSTRAINT "ModaGptCreditLedgerEntry_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModaGptCreditLedgerEntry"
ADD CONSTRAINT "ModaGptCreditLedgerEntry_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "ModaGptCreditReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ModaGptCreditLedgerEntry"
ADD CONSTRAINT "ModaGptCreditLedgerEntry_entryType_check"
CHECK ("entryType" IN ('GRANT', 'PURCHASE', 'BONUS', 'RESERVE', 'CONSUME', 'RELEASE', 'REFUND', 'EXPIRE', 'ADJUSTMENT'));

CREATE FUNCTION "reject_modagpt_credit_ledger_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ModaGPT credit ledger entries are append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "ModaGptCreditLedgerEntry_append_only"
BEFORE UPDATE OR DELETE ON "ModaGptCreditLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "reject_modagpt_credit_ledger_mutation"();

CREATE TABLE "ModaGptAiUsageRecord" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "planId" VARCHAR(32) NOT NULL,
  "feature" VARCHAR(64) NOT NULL,
  "agentId" VARCHAR(48),
  "taskId" VARCHAR(160),
  "provider" VARCHAR(32),
  "model" VARCHAR(120),
  "credits" INTEGER NOT NULL DEFAULT 0,
  "tokens" INTEGER,
  "imageUnits" INTEGER NOT NULL DEFAULT 0,
  "videoSeconds" INTEGER NOT NULL DEFAULT 0,
  "voiceSeconds" INTEGER NOT NULL DEFAULT 0,
  "latencyMs" INTEGER,
  "actualCostMinor" INTEGER,
  "status" VARCHAR(24) NOT NULL DEFAULT 'succeeded',
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModaGptAiUsageRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModaGptAiUsageRecord_idempotencyKey_key"
ON "ModaGptAiUsageRecord"("idempotencyKey");
CREATE INDEX "ModaGptAiUsageRecord_merchantId_createdAt_idx"
ON "ModaGptAiUsageRecord"("merchantId", "createdAt");
CREATE INDEX "ModaGptAiUsageRecord_planId_feature_createdAt_idx"
ON "ModaGptAiUsageRecord"("planId", "feature", "createdAt");
CREATE INDEX "ModaGptAiUsageRecord_provider_model_createdAt_idx"
ON "ModaGptAiUsageRecord"("provider", "model", "createdAt");
ALTER TABLE "ModaGptAiUsageRecord"
ADD CONSTRAINT "ModaGptAiUsageRecord_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModaGptAiUsageRecord"
ADD CONSTRAINT "ModaGptAiUsageRecord_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "ModaGptBillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ModaGptBillingInvoice" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "invoiceNumber" VARCHAR(48) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "subtotalMinor" INTEGER NOT NULL,
  "taxMinor" INTEGER NOT NULL DEFAULT 0,
  "discountMinor" INTEGER NOT NULL DEFAULT 0,
  "totalMinor" INTEGER NOT NULL,
  "planSnapshot" TEXT NOT NULL,
  "lineItemsSnapshot" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModaGptBillingInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModaGptBillingInvoice_invoiceNumber_key"
ON "ModaGptBillingInvoice"("invoiceNumber");
CREATE INDEX "ModaGptBillingInvoice_merchantId_status_createdAt_idx"
ON "ModaGptBillingInvoice"("merchantId", "status", "createdAt");
CREATE INDEX "ModaGptBillingInvoice_subscriptionId_status_idx"
ON "ModaGptBillingInvoice"("subscriptionId", "status");
ALTER TABLE "ModaGptBillingInvoice"
ADD CONSTRAINT "ModaGptBillingInvoice_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModaGptBillingInvoice"
ADD CONSTRAINT "ModaGptBillingInvoice_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "ModaGptBillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ModaGptBillingPayment" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "provider" VARCHAR(24) NOT NULL,
  "providerPaymentId" VARCHAR(160),
  "amountMinor" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModaGptBillingPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModaGptBillingPayment_idempotencyKey_key"
ON "ModaGptBillingPayment"("idempotencyKey");
CREATE INDEX "ModaGptBillingPayment_merchantId_status_createdAt_idx"
ON "ModaGptBillingPayment"("merchantId", "status", "createdAt");
CREATE INDEX "ModaGptBillingPayment_provider_providerPaymentId_idx"
ON "ModaGptBillingPayment"("provider", "providerPaymentId");
ALTER TABLE "ModaGptBillingPayment"
ADD CONSTRAINT "ModaGptBillingPayment_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModaGptBillingPayment"
ADD CONSTRAINT "ModaGptBillingPayment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "ModaGptBillingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ModaGptBillingWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" VARCHAR(24) NOT NULL,
  "providerEventId" VARCHAR(180) NOT NULL,
  "eventType" VARCHAR(80) NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'received',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processedAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModaGptBillingWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModaGptBillingWebhookEvent_provider_providerEventId_key"
ON "ModaGptBillingWebhookEvent"("provider", "providerEventId");
CREATE INDEX "ModaGptBillingWebhookEvent_status_createdAt_idx"
ON "ModaGptBillingWebhookEvent"("status", "createdAt");
