ALTER TABLE "ModaGptBillingInvoice"
  ADD COLUMN "providerInvoiceId" VARCHAR(180),
  ADD COLUMN "taxRateBasisPoints" INTEGER,
  ADD COLUMN "billingCountry" VARCHAR(2),
  ADD COLUMN "taxIdSnapshot" VARCHAR(80),
  ADD COLUMN "periodStart" TIMESTAMP(3),
  ADD COLUMN "periodEnd" TIMESTAMP(3);

CREATE UNIQUE INDEX "ModaGptBillingInvoice_providerInvoiceId_key"
ON "ModaGptBillingInvoice"("providerInvoiceId");

ALTER TABLE "ModaGptBillingSubscription"
  DROP CONSTRAINT "ModaGptBillingSubscription_merchantId_fkey",
  ADD CONSTRAINT "ModaGptBillingSubscription_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModaGptAiUsageRecord"
  DROP CONSTRAINT "ModaGptAiUsageRecord_merchantId_fkey",
  ADD CONSTRAINT "ModaGptAiUsageRecord_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModaGptBillingInvoice"
  DROP CONSTRAINT "ModaGptBillingInvoice_merchantId_fkey",
  ADD CONSTRAINT "ModaGptBillingInvoice_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModaGptBillingPayment"
  DROP CONSTRAINT "ModaGptBillingPayment_merchantId_fkey",
  ADD CONSTRAINT "ModaGptBillingPayment_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
