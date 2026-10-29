CREATE TABLE "GrowthMarketingEvent" (
    "id" TEXT NOT NULL,
    "event" VARCHAR(40) NOT NULL,
    "page" VARCHAR(80) NOT NULL,
    "source" VARCHAR(64) NOT NULL DEFAULT '',
    "medium" VARCHAR(64) NOT NULL DEFAULT '',
    "campaign" VARCHAR(100) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthMarketingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GrowthMarketingEvent_createdAt_event_idx"
ON "GrowthMarketingEvent"("createdAt", "event");

CREATE INDEX "GrowthMarketingEvent_createdAt_source_medium_campaign_idx"
ON "GrowthMarketingEvent"("createdAt", "source", "medium", "campaign");
