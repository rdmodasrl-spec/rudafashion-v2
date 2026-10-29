ALTER TABLE "GrowthCrmFollowUp"
  ADD COLUMN "automationKey" VARCHAR(180);

CREATE UNIQUE INDEX "GrowthCrmFollowUp_automationKey_key"
  ON "GrowthCrmFollowUp"("automationKey");
