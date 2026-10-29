CREATE TABLE "OrderAgreementVersion" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_merchant',
    "proposedByRole" TEXT NOT NULL,
    "proposedById" TEXT,
    "termsSnapshot" TEXT NOT NULL,
    "buyerConfirmedBy" TEXT,
    "buyerConfirmedAt" TIMESTAMP(3),
    "merchantConfirmedBy" TEXT,
    "merchantConfirmedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAgreementVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderChainEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'platform',
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderChainEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderAgreementVersion_orderId_version_key"
ON "OrderAgreementVersion"("orderId", "version");

CREATE INDEX "OrderAgreementVersion_orderId_status_version_idx"
ON "OrderAgreementVersion"("orderId", "status", "version");

CREATE INDEX "OrderChainEvent_orderId_createdAt_idx"
ON "OrderChainEvent"("orderId", "createdAt");

CREATE INDEX "OrderChainEvent_eventType_createdAt_idx"
ON "OrderChainEvent"("eventType", "createdAt");

ALTER TABLE "OrderAgreementVersion"
ADD CONSTRAINT "OrderAgreementVersion_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderChainEvent"
ADD CONSTRAINT "OrderChainEvent_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
