-- Growth prospecting: real merchant lead storage for the platform growth module.
-- Additive and reversible: dropping "GrowthProspect" and the "prospectId" column restores the previous shape.

CREATE TABLE "GrowthProspect" (
  "id" TEXT NOT NULL,
  "companyName" VARCHAR(200) NOT NULL,
  "contactName" VARCHAR(120),
  "email" VARCHAR(200),
  "phone" VARCHAR(60),
  "website" VARCHAR(300),
  "country" VARCHAR(80),
  "city" VARCHAR(120),
  "businessType" VARCHAR(24) NOT NULL DEFAULT 'other',
  "source" VARCHAR(24) NOT NULL DEFAULT 'manual',
  "sourceUrl" VARCHAR(600),
  "sourceNote" VARCHAR(600),
  "status" VARCHAR(24) NOT NULL DEFAULT 'new',
  "dedupeKey" VARCHAR(320) NOT NULL,
  "customerId" VARCHAR(80),
  "merchantId" VARCHAR(80),
  "nextFollowUpAt" TIMESTAMP(3),
  "lastContactAt" TIMESTAMP(3),
  "createdBy" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthProspect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GrowthProspect_businessType_check" CHECK (
    "businessType" IN ('wholesaler', 'brand', 'trading', 'other')
  ),
  CONSTRAINT "GrowthProspect_source_check" CHECK (
    "source" IN ('manual', 'import', 'ai_research')
  ),
  CONSTRAINT "GrowthProspect_status_check" CHECK (
    "status" IN ('new', 'contacted', 'negotiating', 'registered', 'onboarded', 'paused')
  )
);

CREATE UNIQUE INDEX "GrowthProspect_dedupeKey_key" ON "GrowthProspect"("dedupeKey");
CREATE INDEX "GrowthProspect_status_nextFollowUpAt_idx" ON "GrowthProspect"("status", "nextFollowUpAt");
CREATE INDEX "GrowthProspect_country_city_idx" ON "GrowthProspect"("country", "city");
CREATE INDEX "GrowthProspect_createdAt_idx" ON "GrowthProspect"("createdAt");

ALTER TABLE "GrowthCrmFollowUp"
  ADD COLUMN "prospectId" TEXT;

CREATE INDEX "GrowthCrmFollowUp_prospectId_createdAt_idx" ON "GrowthCrmFollowUp"("prospectId", "createdAt");

ALTER TABLE "GrowthCrmFollowUp"
  ADD CONSTRAINT "GrowthCrmFollowUp_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "GrowthProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Follow-ups may now reference exactly one subject: a consumer, a customer, or a prospect.
ALTER TABLE "GrowthCrmFollowUp"
  DROP CONSTRAINT "GrowthCrmFollowUp_exactly_one_subject_check";

ALTER TABLE "GrowthCrmFollowUp"
  ADD CONSTRAINT "GrowthCrmFollowUp_exactly_one_subject_check" CHECK (
    (("consumerId" IS NOT NULL)::int + ("customerId" IS NOT NULL)::int + ("prospectId" IS NOT NULL)::int) = 1
  );
